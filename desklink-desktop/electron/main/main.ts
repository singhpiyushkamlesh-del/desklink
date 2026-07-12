import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './windows/mainWindow';
import { registerIpcHandlers } from './ipc/handlers';
import { createDatabaseManager } from './storage/database';
import { initWsServerManager } from './websocket/server';
import { DEFAULT_WS_PORT } from '../shared/protocol';
import { pairingSessionManager } from './security/pairing';
import { initMdnsAdvertiser, stopMdnsAdvertiser, getMdnsAdvertiser } from './discovery/mdnsAdvertiser';

import { getSmsClient } from './sms/smsClient';
import { getPhotosClient } from './photos/photosClient';
import { getClipboardSyncManager } from './clipboard/clipboardSync';

const db = createDatabaseManager();
const wsServerManager = initWsServerManager(db);

let mainWindow: BrowserWindow | null = null;

async function bootstrap(): Promise<void> {
  await db.initialize();
  getSmsClient().attach(wsServerManager.getSessionHandler());
  getPhotosClient().attach(wsServerManager.getSessionHandler());
  const clipboardSync = getClipboardSyncManager();
  clipboardSync.attach(wsServerManager.getSessionHandler(), db);
  clipboardSync.start();
  registerIpcHandlers(db, wsServerManager);

  wsServerManager.start(DEFAULT_WS_PORT);
  await initMdnsAdvertiser(db, DEFAULT_WS_PORT);
  pairingSessionManager.startSession();
  wsServerManager.getPairingHandler().startWaiting();
  getMdnsAdvertiser()?.refresh();

  mainWindow = createMainWindow();
  wsServerManager.setMainWindow(mainWindow);
  getClipboardSyncManager().setMainWindow(mainWindow);

  mainWindow.on('closed', () => {
    wsServerManager.setMainWindow(null);
    getClipboardSyncManager().setMainWindow(null);
    mainWindow = null;
  });
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', () => {
  getClipboardSyncManager().stop();
  stopMdnsAdvertiser();
  wsServerManager.stop();
  db.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    wsServerManager.setMainWindow(mainWindow);
    getClipboardSyncManager().setMainWindow(mainWindow);
  }
});
