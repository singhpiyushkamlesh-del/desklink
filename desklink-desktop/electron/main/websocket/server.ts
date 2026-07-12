import { WebSocketServer, type WebSocket } from 'ws';
import type { BrowserWindow } from 'electron';
import type { ConnectionState } from '../../shared/protocol';
import type { IDatabaseManager } from '../storage/repositories';
import { PairingHandler } from './pairingHandler';
import { SessionHandler, type LiveDeviceStatus } from './sessionHandler';

export type WsServerState = 'stopped' | 'listening' | 'error';

export class WebSocketServerManager {
  private server: WebSocketServer | null = null;
  private state: WsServerState = 'stopped';
  private connectionState: ConnectionState = 'disconnected';
  private mainWindow: BrowserWindow | null = null;
  private pairingHandler: PairingHandler;
  private sessionHandler: SessionHandler;

  constructor(private readonly db: IDatabaseManager) {
    this.pairingHandler = new PairingHandler(db);
    this.sessionHandler = new SessionHandler(db);
  }

  setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
    this.pairingHandler.setMainWindow(win);
    this.sessionHandler.setMainWindow(win);
  }

  getPairingHandler(): PairingHandler {
    return this.pairingHandler;
  }

  getSessionHandler(): SessionHandler {
    return this.sessionHandler;
  }

  getLatestDeviceStatus(): LiveDeviceStatus | null {
    return this.sessionHandler.getLatestStatus();
  }

  start(port: number): void {
    if (this.server) return;

    try {
      this.server = new WebSocketServer({ host: '0.0.0.0', port });

      this.server.on('listening', () => {
        this.state = 'listening';
        this.broadcastConnectionState();
      });

      this.server.on('error', (err) => {
        console.error('[DeskLink] WebSocket server error:', err);
        this.state = 'error';
        this.broadcastConnectionState();
      });

      this.server.on('connection', (socket) => {
        this.setConnectionState('connecting');
        this.attachSocketHandlers(socket);
      });
    } catch (err) {
      console.error('[DeskLink] Failed to start WebSocket server:', err);
      this.state = 'error';
    }
  }

  private attachSocketHandlers(socket: WebSocket) {
    const send = (json: string) => {
      if (socket.readyState === socket.OPEN) socket.send(json);
    };

    socket.on('message', async (data) => {
      const raw = data.toString();

      const pairingHandled = await this.pairingHandler.handleMessage(raw, send);
      if (pairingHandled) {
        const status = this.pairingHandler.getStatus();
        if (status.status === 'success') {
          this.setConnectionState('paired');
        }
        return;
      }

      const sessionResult = await this.sessionHandler.handleMessage(socket, raw, send);
      if (sessionResult === 'auth') {
        this.setConnectionState('connected');
      } else if (sessionResult === 'status') {
        // status broadcast handled in sessionHandler
      }
    });

    socket.on('close', () => {
      const wasAuthenticated = this.sessionHandler.isSocketAuthenticated(socket);
      this.sessionHandler.clearSession(socket);
      if (wasAuthenticated || !this.sessionHandler.getAuthenticatedDeviceId()) {
        this.setConnectionState('disconnected');
      }
    });

    socket.on('error', (err) => {
      console.error('[DeskLink] WebSocket client error:', err);
    });
  }

  private setConnectionState(state: ConnectionState) {
    this.connectionState = state;
    this.mainWindow?.webContents.send('desklink:connection-state-changed', {
      state,
      serverState: this.state,
      deviceId: this.sessionHandler.getAuthenticatedDeviceId(),
    });
  }

  private broadcastConnectionState() {
    this.setConnectionState(this.connectionState);
  }

  stop(): void {
    this.server?.close();
    this.server = null;
    this.state = 'stopped';
    this.connectionState = 'disconnected';
  }

  getState(): WsServerState {
    return this.state;
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }
}

let wsServerInstance: WebSocketServerManager | null = null;

export function initWsServerManager(db: IDatabaseManager): WebSocketServerManager {
  wsServerInstance = new WebSocketServerManager(db);
  return wsServerInstance;
}

export function getWsServerManager(): WebSocketServerManager {
  if (!wsServerInstance) {
    throw new Error('WebSocket server not initialized');
  }
  return wsServerInstance;
}
