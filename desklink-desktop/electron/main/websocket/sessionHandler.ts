import type { BrowserWindow } from 'electron';
import type { WebSocket } from 'ws';
import type {
  AuthEstablishedPayload,
  ClipboardUpdatePayload,
  DeviceStatusPayload,
  EventEnvelope,
  HeartbeatPayload,
  NotificationNewPayload,
} from '../../shared/protocol';
import { createEvent, PROTOCOL_VERSION } from '../../shared/protocol';
import type { IDatabaseManager } from '../storage/repositories';
import { getSmsClient } from '../sms/smsClient';
import { getPhotosClient } from '../photos/photosClient';
import { getClipboardSyncManager } from '../clipboard/clipboardSync';

export interface LiveDeviceStatus extends DeviceStatusPayload {
  deviceId: string;
  lastSyncTime: number;
}

export class SessionHandler {
  private authenticatedDeviceId: string | null = null;
  private authenticatedSocket: WebSocket | null = null;
  private latestStatus: LiveDeviceStatus | null = null;
  private heartbeatSequence = 0;
  private mainWindow: BrowserWindow | null = null;

  constructor(private readonly db: IDatabaseManager) {}

  setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  getAuthenticatedDeviceId(): string | null {
    return this.authenticatedDeviceId;
  }

  getLatestStatus(): LiveDeviceStatus | null {
    return this.latestStatus;
  }

  isSocketAuthenticated(socket: WebSocket): boolean {
    return this.authenticatedSocket === socket && this.authenticatedDeviceId !== null;
  }

  sendToDevice(envelope: ReturnType<typeof createEvent>): boolean {
    if (!this.authenticatedSocket || this.authenticatedSocket.readyState !== this.authenticatedSocket.OPEN) {
      return false;
    }
    this.authenticatedSocket.send(JSON.stringify(envelope));
    return true;
  }

  revokeDevice(deviceId: string): void {
    if (this.authenticatedDeviceId !== deviceId || !this.authenticatedSocket) return;
    const socket = this.authenticatedSocket;
    if (socket.readyState === socket.OPEN) {
      socket.close(1000, 'Device unpaired');
    }
    this.clearSession(socket);
  }

  clearSession(socket: WebSocket) {
    if (this.authenticatedSocket === socket) {
      this.authenticatedSocket = null;
      this.authenticatedDeviceId = null;
      this.latestStatus = null;
      this.broadcastConnectionState('disconnected');
      void this.db.syncLogs.append('info', 'Device disconnected', 'auth:session');
    }
  }

  async handleMessage(
    socket: WebSocket,
    raw: string,
    send: (json: string) => void,
  ): Promise<'auth' | 'heartbeat' | 'status' | 'notification' | 'sms' | 'photos' | 'clipboard' | 'unknown' | 'error'> {
    let envelope: EventEnvelope;
    try {
      envelope = JSON.parse(raw) as EventEnvelope;
    } catch {
      return 'error';
    }

    if (envelope.version !== PROTOCOL_VERSION) {
      return 'error';
    }

    switch (envelope.type) {
      case 'auth:established':
        return (await this.handleAuth(socket, envelope.payload as AuthEstablishedPayload, send))
          ? 'auth'
          : 'error';
      case 'heartbeat':
        return this.handleHeartbeat(socket, envelope.payload as HeartbeatPayload, send) ? 'heartbeat' : 'error';
      case 'device:status':
        return this.handleDeviceStatus(socket, envelope.payload as DeviceStatusPayload) ? 'status' : 'error';
      case 'notification:new':
        return (await this.handleNotification(socket, envelope.payload as NotificationNewPayload))
          ? 'notification'
          : 'error';
      case 'sms:list:response':
      case 'sms:thread:response':
      case 'sms:send:ack':
        return getSmsClient().handleIncomingEnvelope(envelope) ? 'sms' : 'error';
      case 'photos:list:response':
      case 'photo:download:chunk':
      case 'photo:download:complete':
        return getPhotosClient().handleIncomingEnvelope(envelope) ? 'photos' : 'error';
      case 'clipboard:update':
        return (await getClipboardSyncManager().handleIncoming(
          envelope.payload as ClipboardUpdatePayload,
        ))
          ? 'clipboard'
          : 'error';
      case 'sync:error':
        if (getSmsClient().handleIncomingEnvelope(envelope)) return 'sms';
        if (getPhotosClient().handleIncomingEnvelope(envelope)) return 'photos';
        return 'unknown';
      default:
        return 'unknown';
    }
  }

  private async handleAuth(
    socket: WebSocket,
    payload: AuthEstablishedPayload,
    send: (json: string) => void,
  ): Promise<boolean> {
    const device = await this.db.devices.findByAuthToken(payload.sessionToken);

    if (!device || device.id !== payload.deviceId || device.trusted !== 1) {
      void this.db.syncLogs.append(
        'warn',
        `Auth rejected for device ${payload.deviceId}`,
        'auth:established',
      );
      send(
        JSON.stringify(
          createEvent('sync:error', {
            code: 'AUTH_FAILED',
            message: 'Invalid session token or unknown device',
            relatedType: 'auth:established',
          }),
        ),
      );
      socket.close(1008, 'Authentication failed');
      return false;
    }

    this.authenticatedSocket = socket;
    this.authenticatedDeviceId = device.id;
    await this.db.devices.updateLastSeen(device.id, Date.now());

    const ack = createEvent('auth:established', {
      sessionToken: payload.sessionToken,
      deviceId: payload.deviceId,
    } satisfies AuthEstablishedPayload);

    send(JSON.stringify(ack));
    this.broadcastConnectionState('connected');
    void this.db.syncLogs.append('info', `Device connected: ${device.device_name}`, 'auth:established');

    return true;
  }

  private handleHeartbeat(
    socket: WebSocket,
    payload: HeartbeatPayload,
    send: (json: string) => void,
  ): boolean {
    if (!this.isSocketAuthenticated(socket)) return false;

    this.heartbeatSequence = payload.sequence;
    const reply = createEvent('heartbeat', { sequence: payload.sequence });
    send(JSON.stringify(reply));

    if (this.authenticatedDeviceId) {
      void this.db.devices.updateLastSeen(this.authenticatedDeviceId, Date.now());
    }

    return true;
  }

  private handleDeviceStatus(socket: WebSocket, payload: DeviceStatusPayload): boolean {
    if (!this.isSocketAuthenticated(socket) || !this.authenticatedDeviceId) return false;

    const now = Date.now();
    this.latestStatus = {
      ...payload,
      deviceId: this.authenticatedDeviceId,
      lastSyncTime: now,
    };

    void this.db.devices.updateLastSeen(this.authenticatedDeviceId, now);
    this.mainWindow?.webContents.send('desklink:device-status-changed', this.latestStatus);

    return true;
  }

  private async handleNotification(
    socket: WebSocket,
    payload: NotificationNewPayload,
  ): Promise<boolean> {
    if (!this.isSocketAuthenticated(socket) || !this.authenticatedDeviceId) return false;

    const row = {
      id: payload.id,
      device_id: this.authenticatedDeviceId,
      app_package: payload.appPackage,
      app_name: payload.appName,
      title: payload.title,
      body: payload.body,
      timestamp: payload.timestamp,
      raw_payload: JSON.stringify(payload),
    };

    await this.db.notifications.save(row);
    await this.db.devices.updateLastSeen(this.authenticatedDeviceId, Date.now());
    void this.db.syncLogs.append(
      'info',
      `Notification from ${payload.appName}: ${payload.title}`,
      'notification:new',
    );

    this.mainWindow?.webContents.send('desklink:notification-new', {
      id: row.id,
      deviceId: row.device_id,
      appPackage: row.app_package,
      appName: row.app_name,
      title: row.title,
      body: row.body,
      timestamp: row.timestamp,
    });

    return true;
  }

  private broadcastConnectionState(state: 'connected' | 'connecting' | 'disconnected' | 'paired') {
    this.mainWindow?.webContents.send('desklink:connection-state-changed', {
      state,
      serverState: 'listening',
      deviceId: this.authenticatedDeviceId,
    });
  }
}
