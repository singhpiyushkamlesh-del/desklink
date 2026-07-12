import { ipcMain, shell, app } from 'electron';
import fs from 'fs';
import path from 'path';
import type { IDatabaseManager } from '../storage/repositories';
import type { WebSocketServerManager } from '../websocket/server';
import { getLocalIpAddress, getLocalIpCandidates } from '../security/network';
import { pairingSessionManager } from '../security/pairing';
import type { MessageRow, MessageThreadRow, NotificationRow, PhotoRow } from '../storage/schema';
import { getSmsClient } from '../sms/smsClient';
import { getPhotosClient } from '../photos/photosClient';
import { getClipboardSyncManager } from '../clipboard/clipboardSync';
import { getMdnsAdvertiser } from '../discovery/mdnsAdvertiser';
import { DEFAULT_WS_PORT, PROTOCOL_VERSION } from '../../shared/protocol';

function thumbnailsDir(): string {
  const dir = path.join(app.getPath('userData'), 'thumbnails');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function photosDir(): string {
  const dir = path.join(app.getPath('userData'), 'photos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveThumbnail(photoId: string, base64: string): string {
  const filePath = path.join(thumbnailsDir(), `${photoId}.jpg`);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return filePath;
}

function readThumbnailDataUrl(thumbnailPath: string | null): string | null {
  if (!thumbnailPath || !fs.existsSync(thumbnailPath)) return null;
  const b64 = fs.readFileSync(thumbnailPath).toString('base64');
  return `data:image/jpeg;base64,${b64}`;
}

function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    deviceId: row.device_id,
    appPackage: row.app_package,
    appName: row.app_name,
    title: row.title,
    body: row.body,
    timestamp: row.timestamp,
  };
}

function mapThread(row: MessageThreadRow) {
  return {
    id: row.id,
    deviceId: row.device_id,
    address: row.address,
    displayName: row.display_name,
    lastMessage: row.last_message,
    lastTimestamp: row.last_timestamp,
  };
}

function mapMessage(row: MessageRow) {
  return {
    id: row.id,
    threadId: row.thread_id,
    address: row.address,
    body: row.body,
    direction: row.direction,
    timestamp: row.timestamp,
    status: row.status,
  };
}

function mapPhoto(row: PhotoRow) {
  return {
    id: row.id,
    deviceId: row.device_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    thumbnailUrl: readThumbnailDataUrl(row.thumbnail_path),
    localPath: row.local_cache_path,
  };
}

async function resolveDeviceId(
  db: IDatabaseManager,
  sessionHandler: ReturnType<WebSocketServerManager['getSessionHandler']>,
  deviceId?: string,
): Promise<string | null> {
  if (deviceId) return deviceId;
  const sessionId = sessionHandler.getAuthenticatedDeviceId();
  if (sessionId) return sessionId;
  const devices = await db.devices.findAll();
  return devices[0]?.id ?? null;
}

export function registerIpcHandlers(
  db: IDatabaseManager,
  wsServerManager: WebSocketServerManager,
): void {
  const pairingHandler = wsServerManager.getPairingHandler();
  const sessionHandler = wsServerManager.getSessionHandler();
  const smsClient = getSmsClient();
  const photosClient = getPhotosClient();

  ipcMain.handle('desklink:get-photos', async (_event, forceRefresh?: boolean) => {
    const targetId = await resolveDeviceId(db, sessionHandler);
    if (!targetId) return [];

    if (forceRefresh) {
      try {
        const response = await photosClient.fetchPhotos(40);
        for (const photo of response.photos) {
          const existing = await db.photos.findById(photo.id);
          const thumbnailPath = photo.thumbnailBase64
            ? saveThumbnail(photo.id, photo.thumbnailBase64)
            : existing?.thumbnail_path ?? null;
          await db.photos.save({
            id: photo.id,
            device_id: targetId,
            remote_uri: photo.id,
            file_name: photo.fileName,
            mime_type: photo.mimeType,
            created_at: photo.createdAt,
            thumbnail_path: thumbnailPath,
            local_cache_path: existing?.local_cache_path ?? null,
          });
        }
      } catch (error) {
        const cached = await db.photos.findByDevice(targetId);
        if (cached.length > 0) return cached.map(mapPhoto);
        throw error;
      }
    }

    const rows = await db.photos.findByDevice(targetId);
    return rows.map(mapPhoto);
  });

  ipcMain.handle('desklink:download-photo', async (_event, photoId: string) => {
    if (!photoId) throw new Error('Photo ID required');

    const result = await photosClient.downloadPhoto(photoId);
    const safeName = result.fileName.replace(/[<>:"/\\|?*]/g, '_');
    const filePath = path.join(photosDir(), `${result.photoId}_${safeName}`);
    fs.writeFileSync(filePath, result.data);
    await db.photos.updateLocalPath(photoId, filePath);

    const existing = await db.photos.findById(photoId);
    if (existing) {
      await db.photos.save({
        ...existing,
        file_name: result.fileName,
        mime_type: result.mimeType,
        local_cache_path: filePath,
      });
    }

    await db.syncLogs.append('info', `Downloaded photo: ${result.fileName}`, 'photo:download:complete');
    return { path: filePath, fileName: result.fileName };
  });

  ipcMain.handle('desklink:open-photo', async (_event, filePath: string) => {
    if (filePath && fs.existsSync(filePath)) {
      await shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle('desklink:get-clipboard-sync-enabled', async () => {
    return getClipboardSyncManager().getEnabled();
  });

  ipcMain.handle('desklink:set-clipboard-sync-enabled', async (_event, enabled: boolean) => {
    await getClipboardSyncManager().setEnabled(Boolean(enabled));
    return getClipboardSyncManager().getEnabled();
  });

  ipcMain.handle('desklink:unpair-device', async (_event, deviceId: string) => {
    if (!deviceId) throw new Error('Device ID required');

    const device = await db.devices.findById(deviceId);
    sessionHandler.revokeDevice(deviceId);
    await db.purgeDeviceData(deviceId);
    await db.devices.remove(deviceId);
    await db.syncLogs.append(
      'info',
      `Device unpaired: ${device?.device_name ?? deviceId}`,
      'pair:revoked',
    );

    return { success: true };
  });

  ipcMain.handle('desklink:get-sms-threads', async (_event, forceRefresh?: boolean) => {
    const targetId = await resolveDeviceId(db, sessionHandler);
    if (!targetId) return [];

    if (forceRefresh) {
      try {
        const response = await smsClient.fetchThreads(50);
        for (const thread of response.threads) {
          await db.messages.saveThread({
            id: thread.threadId,
            device_id: targetId,
            address: thread.address,
            display_name: thread.displayName ?? thread.address,
            last_message: thread.lastMessage,
            last_timestamp: thread.lastTimestamp,
          });
        }
      } catch (error) {
        const cached = await db.messages.findThreads(targetId);
        if (cached.length > 0) return cached.map(mapThread);
        throw error;
      }
    }

    const rows = await db.messages.findThreads(targetId);
    return rows.map(mapThread);
  });

  ipcMain.handle(
    'desklink:get-sms-messages',
    async (_event, threadId: string, forceRefresh?: boolean) => {
      if (!threadId) return [];

      if (forceRefresh) {
        try {
          const response = await smsClient.fetchThreadMessages(threadId);
          for (const msg of response.messages) {
            await db.messages.saveMessage({
              id: msg.id,
              thread_id: threadId,
              address: msg.address,
              body: msg.body,
              direction: msg.direction,
              timestamp: msg.timestamp,
              status: msg.status ?? 'delivered',
            });
          }
        } catch (error) {
          const cached = await db.messages.findMessages(threadId);
          if (cached.length > 0) return cached.map(mapMessage);
          throw error;
        }
      }

      const rows = await db.messages.findMessages(threadId);
      return rows.map(mapMessage);
    },
  );

  ipcMain.handle(
    'desklink:send-sms',
    async (
      _event,
      payload: { threadId: string; address: string; body: string; clientMessageId: string },
    ) => {
      const targetId = await resolveDeviceId(db, sessionHandler);
      if (!targetId) throw new Error('No paired device');

      const optimistic: MessageRow = {
        id: payload.clientMessageId,
        thread_id: payload.threadId,
        address: payload.address,
        body: payload.body,
        direction: 'outbound',
        timestamp: Date.now(),
        status: 'sending',
      };
      await db.messages.saveMessage(optimistic);

      const thread = (await db.messages.findThreads(targetId)).find((t) => t.id === payload.threadId);
      if (thread) {
        await db.messages.saveThread({
          ...thread,
          last_message: payload.body,
          last_timestamp: Date.now(),
        });
      }

      try {
        const ack = await smsClient.sendMessage(payload.address, payload.body, payload.clientMessageId);
        await db.messages.saveMessage({
          ...optimistic,
          status: ack.success ? 'sent' : 'failed',
        });
        if (!ack.success) {
          throw new Error(ack.error ?? 'Failed to send SMS');
        }
        return { success: true, clientMessageId: payload.clientMessageId };
      } catch (error) {
        await db.messages.saveMessage({
          ...optimistic,
          status: 'failed',
        });
        throw error;
      }
    },
  );

  ipcMain.handle('desklink:get-notifications', async (_event, deviceId?: string, query?: string) => {
    const sessionDeviceId = sessionHandler.getAuthenticatedDeviceId();
    const devices = await db.devices.findAll();
    const targetId = deviceId ?? sessionDeviceId ?? devices[0]?.id;
    if (!targetId) return [];

    if (query?.trim()) {
      return (await db.notifications.search(targetId, query)).map(mapNotification);
    }
    return (await db.notifications.findByDevice(targetId)).map(mapNotification);
  });

  ipcMain.handle('desklink:get-connection-state', () => {
    return {
      state: wsServerManager.getConnectionState(),
      serverState: wsServerManager.getState(),
      deviceId: sessionHandler.getAuthenticatedDeviceId(),
    };
  });

  ipcMain.handle('desklink:get-device-status', () => {
    return wsServerManager.getLatestDeviceStatus();
  });

  ipcMain.handle('desklink:get-devices', async () => {
    return db.devices.findAll();
  });

  ipcMain.handle('desklink:get-logs', async (_event, limit?: number) => {
    return db.syncLogs.findRecent(limit ?? 100);
  });

  ipcMain.handle('desklink:get-network-info', () => {
    const candidates = getLocalIpCandidates();
    const advertiser = getMdnsAdvertiser();
    return {
      localIp: getLocalIpAddress(),
      port: DEFAULT_WS_PORT,
      candidates: candidates.map((c) => ({ name: c.name, address: c.address })),
      mdnsServiceName: advertiser?.getServiceName() ?? null,
      mdnsAdvertising: advertiser?.isAdvertising() ?? false,
      hasActivePairingToken: pairingSessionManager.getActiveToken() !== null,
    };
  });

  ipcMain.handle('desklink:get-pairing-info', () => {
    const token = pairingSessionManager.getActiveToken();
    if (!token && pairingHandler.getStatus().status === 'waiting') {
      pairingHandler.markExpired();
    }
    return {
      host: getLocalIpAddress(),
      port: DEFAULT_WS_PORT,
      token: token ?? null,
      hasActiveSession: token !== null,
      protocolVersion: PROTOCOL_VERSION,
    };
  });

  ipcMain.handle('desklink:get-pairing-status', () => {
    return pairingHandler.getStatus();
  });

  ipcMain.handle('desklink:start-pairing-session', () => {
    const token = pairingSessionManager.startSession();
    pairingHandler.startWaiting();
    getMdnsAdvertiser()?.refresh();
    return {
      host: getLocalIpAddress(),
      port: DEFAULT_WS_PORT,
      token,
      protocolVersion: PROTOCOL_VERSION,
    };
  });
}