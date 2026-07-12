import { clipboard } from 'electron';
import type { BrowserWindow } from 'electron';
import type { ClipboardUpdatePayload } from '../../shared/protocol';
import { createEvent } from '../../shared/protocol';
import type { IDatabaseManager } from '../storage/repositories';
import type { SessionHandler } from '../websocket/sessionHandler';

const META_KEY = 'clipboard_sync';
const POLL_INTERVAL_MS = 750;

export interface ClipboardSyncEvent {
  direction: 'inbound' | 'outbound';
  preview: string;
  timestamp: number;
}

export class ClipboardSyncManager {
  private sessionHandler: SessionHandler | null = null;
  private db: IDatabaseManager | null = null;
  private mainWindow: BrowserWindow | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  private suppressLocalEcho = false;
  private lastClipboardText = '';
  private lastAppliedRemoteTimestamp = 0;
  private lastSentText = '';

  attach(sessionHandler: SessionHandler, db: IDatabaseManager) {
    this.sessionHandler = sessionHandler;
    this.db = db;
  }

  setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  start() {
    this.stop();
    this.lastClipboardText = clipboard.readText();
    this.pollTimer = setInterval(() => {
      void this.pollClipboard();
    }, POLL_INTERVAL_MS);
  }

  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async getEnabled(): Promise<boolean> {
    const val = await this.db?.meta.get(META_KEY);
    if (val === null || val === undefined) return true;
    return val === 'true';
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await this.db?.meta.set(META_KEY, String(enabled));
  }

  async handleIncoming(payload: ClipboardUpdatePayload): Promise<boolean> {
    if (payload.origin !== 'android') return true;
    if (!(await this.getEnabled())) return true;

    if (payload.originTimestamp <= this.lastAppliedRemoteTimestamp) return true;

    const current = clipboard.readText();
    if (current === payload.text) {
      this.lastAppliedRemoteTimestamp = payload.originTimestamp;
      return true;
    }

    this.suppressLocalEcho = true;
    this.lastAppliedRemoteTimestamp = payload.originTimestamp;
    this.lastClipboardText = payload.text;
    this.lastSentText = payload.text;
    clipboard.writeText(payload.text);

    setTimeout(() => {
      this.suppressLocalEcho = false;
    }, 200);

    void this.db?.syncLogs.append(
      'info',
      `Clipboard received from phone (${payload.text.length} chars)`,
      'clipboard:update',
    );

    this.emitEvent({
      direction: 'inbound',
      preview: payload.text.slice(0, 80),
      timestamp: payload.originTimestamp,
    });

    return true;
  }

  private async pollClipboard() {
    if (this.suppressLocalEcho) return;
    if (!(await this.getEnabled())) return;
    if (!this.sessionHandler?.getAuthenticatedDeviceId()) return;

    const text = clipboard.readText();
    if (!text || text === this.lastClipboardText) return;

    this.lastClipboardText = text;
    if (text === this.lastSentText) return;

    const originTimestamp = Date.now();
    const sent = this.sessionHandler.sendToDevice(
      createEvent('clipboard:update', {
        text,
        origin: 'desktop',
        originTimestamp,
      }),
    );

    if (sent) {
      this.lastSentText = text;
      void this.db?.syncLogs.append(
        'info',
        `Clipboard sent to phone (${text.length} chars)`,
        'clipboard:update',
      );
      this.emitEvent({
        direction: 'outbound',
        preview: text.slice(0, 80),
        timestamp: originTimestamp,
      });
    }
  }

  private emitEvent(event: ClipboardSyncEvent) {
    this.mainWindow?.webContents.send('desklink:clipboard-updated', event);
  }
}

let clipboardSyncInstance: ClipboardSyncManager | null = null;

export function getClipboardSyncManager(): ClipboardSyncManager {
  if (!clipboardSyncInstance) {
    clipboardSyncInstance = new ClipboardSyncManager();
  }
  return clipboardSyncInstance;
}
