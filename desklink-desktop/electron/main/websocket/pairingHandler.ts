import type { BrowserWindow } from 'electron';
import type { EventEnvelope } from '../../shared/protocol';
import type { EventType, PairAcceptedPayload, PairRequestPayload, SyncErrorPayload } from '../../shared/protocol';
import { createEvent, PROTOCOL_VERSION } from '../../shared/protocol';
import type { IDatabaseManager } from '../storage/repositories';
import { pairingSessionManager } from '../security/pairing';
import { getMdnsAdvertiser } from '../discovery/mdnsAdvertiser';
import { createSessionToken, getOrCreateDesktopIdentity, savePairedDevice } from '../security/identity';

export type PairingStatus = 'idle' | 'waiting' | 'pairing' | 'success' | 'error' | 'expired';

export interface PairingStatusInfo {
  status: PairingStatus;
  deviceName?: string;
  deviceId?: string;
  error?: string;
}

type StatusListener = (info: PairingStatusInfo) => void;

export class PairingHandler {
  private status: PairingStatusInfo = { status: 'idle' };
  private listeners = new Set<StatusListener>();
  private mainWindow: BrowserWindow | null = null;

  constructor(private readonly db: IDatabaseManager) {}

  setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  getStatus(): PairingStatusInfo {
    return { ...this.status };
  }

  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  startWaiting() {
    this.setStatus({ status: 'waiting' });
  }

  markExpired() {
    this.setStatus({ status: 'expired', error: 'Pairing session expired. Generate a new QR code.' });
    getMdnsAdvertiser()?.refresh();
  }

  async handleMessage(raw: string, send: (json: string) => void): Promise<boolean> {
    let envelope: EventEnvelope;
    try {
      envelope = JSON.parse(raw) as EventEnvelope;
    } catch {
      this.sendError(send, 'INVALID_JSON', 'Malformed JSON message');
      return false;
    }

    if (envelope.version !== PROTOCOL_VERSION) {
      this.sendError(send, 'VERSION_MISMATCH', `Unsupported protocol version: ${envelope.version}`);
      return false;
    }

    if (envelope.type === 'pair:request') {
      await this.handlePairRequest(envelope.payload as PairRequestPayload, send);
      return true;
    }

    return false;
  }

  private async handlePairRequest(payload: PairRequestPayload, send: (json: string) => void) {
    this.setStatus({ status: 'pairing' });

    if (!pairingSessionManager.validateToken(payload.pairingToken)) {
      this.setStatus({
        status: 'error',
        error: 'Invalid or expired pairing token',
      });
      this.sendError(send, 'INVALID_TOKEN', 'Pairing token is invalid or expired', 'pair:request');
      return;
    }

    const sessionToken = createSessionToken();
    const identity = await getOrCreateDesktopIdentity(this.db);

    await savePairedDevice(this.db, {
      deviceId: payload.deviceId,
      deviceName: payload.deviceName,
      deviceModel: payload.deviceModel,
      androidVersion: payload.androidVersion,
      sessionToken,
    });

    pairingSessionManager.clearSession();
    getMdnsAdvertiser()?.refresh();

    const accepted = createEvent('pair:accepted', {
      sessionToken,
      desktopName: identity.desktopName,
      desktopId: identity.desktopId,
    } satisfies PairAcceptedPayload);

    send(JSON.stringify(accepted));

    this.setStatus({
      status: 'success',
      deviceName: payload.deviceName,
      deviceId: payload.deviceId,
    });
  }

  private sendError(
    send: (json: string) => void,
    code: string,
    message: string,
    relatedType?: EventType,
  ) {
    const error = createEvent('sync:error', {
      code,
      message,
      relatedType,
    } satisfies SyncErrorPayload);
    send(JSON.stringify(error));
  }

  private setStatus(info: PairingStatusInfo) {
    this.status = info;
    for (const listener of this.listeners) {
      listener(this.status);
    }
    this.mainWindow?.webContents.send('desklink:pairing-status-changed', this.status);
  }
}
