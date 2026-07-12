import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { DeviceRow, MessageRow, MessageThreadRow, NotificationRow, PhotoRow, SyncLogRow } from './schema';
import type { IDatabaseManager } from './repositories';

interface StoreFile {
  devices: DeviceRow[];
  notifications: NotificationRow[];
  message_threads: MessageThreadRow[];
  messages: MessageRow[];
  photos: PhotoRow[];
  sync_logs: SyncLogRow[];
  meta: Record<string, string>;
  next_log_id: number;
}

function emptyStore(): StoreFile {
  return {
    devices: [],
    notifications: [],
    message_threads: [],
    messages: [],
    photos: [],
    sync_logs: [],
    meta: {},
    next_log_id: 1,
  };
}

export function createDatabaseManager(): IDatabaseManager {
  let storePath = '';
  let data: StoreFile = emptyStore();

  const persist = () => {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8');
  };

  return {
    async initialize() {
      storePath = path.join(app.getPath('userData'), 'desklink-store.json');
      if (fs.existsSync(storePath)) {
        try {
          data = { ...emptyStore(), ...JSON.parse(fs.readFileSync(storePath, 'utf-8')) };
          if (!data.notifications) data.notifications = [];
          if (!data.message_threads) data.message_threads = [];
          if (!data.messages) data.messages = [];
          if (!data.photos) data.photos = [];
        } catch {
          data = emptyStore();
        }
      } else {
        persist();
      }
    },

    close() {
      persist();
    },

    async purgeDeviceData(deviceId: string) {
      const threadIds = data.message_threads
        .filter((t) => t.device_id === deviceId)
        .map((t) => t.id);
      data.notifications = data.notifications.filter((n) => n.device_id !== deviceId);
      data.message_threads = data.message_threads.filter((t) => t.device_id !== deviceId);
      data.messages = data.messages.filter((m) => !threadIds.includes(m.thread_id));
      data.photos = data.photos.filter((p) => p.device_id !== deviceId);
      persist();
    },

    devices: {
      async findAll() {
        return [...data.devices].sort((a, b) => b.paired_at - a.paired_at);
      },

      async findById(id: string) {
        return data.devices.find((d) => d.id === id) ?? null;
      },

      async findByAuthToken(token: string) {
        return data.devices.find((d) => d.auth_token === token) ?? null;
      },

      async save(device: DeviceRow) {
        const idx = data.devices.findIndex((d) => d.id === device.id);
        if (idx >= 0) data.devices[idx] = device;
        else data.devices.push(device);
        persist();
      },

      async remove(id: string) {
        data.devices = data.devices.filter((d) => d.id !== id);
        persist();
      },

      async updateLastSeen(id: string, timestamp: number) {
        const device = data.devices.find((d) => d.id === id);
        if (device) {
          device.last_seen = timestamp;
          persist();
        }
      },
    },

    notifications: {
      async findByDevice(deviceId: string, limit = 200) {
        return data.notifications
          .filter((n) => n.device_id === deviceId)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },

      async save(notification: NotificationRow) {
        const idx = data.notifications.findIndex((n) => n.id === notification.id);
        if (idx >= 0) data.notifications[idx] = notification;
        else data.notifications.unshift(notification);
        if (data.notifications.length > 1000) {
          data.notifications = data.notifications.slice(0, 1000);
        }
        persist();
      },

      async search(deviceId: string, query: string) {
        const q = query.trim().toLowerCase();
        if (!q) return this.findByDevice(deviceId);
        return data.notifications
          .filter(
            (n) =>
              n.device_id === deviceId &&
              [n.app_name, n.app_package, n.title, n.body]
                .filter(Boolean)
                .some((field) => field!.toLowerCase().includes(q)),
          )
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 200);
      },
    },

    messages: {
      async findThreads(deviceId: string) {
        return data.message_threads
          .filter((t) => t.device_id === deviceId)
          .sort((a, b) => (b.last_timestamp ?? 0) - (a.last_timestamp ?? 0));
      },

      async findMessages(threadId: string) {
        return data.messages
          .filter((m) => m.thread_id === threadId)
          .sort((a, b) => a.timestamp - b.timestamp);
      },

      async saveThread(thread: MessageThreadRow) {
        const idx = data.message_threads.findIndex((t) => t.id === thread.id);
        if (idx >= 0) data.message_threads[idx] = thread;
        else data.message_threads.push(thread);
        persist();
      },

      async saveMessage(message: MessageRow) {
        const idx = data.messages.findIndex((m) => m.id === message.id);
        if (idx >= 0) data.messages[idx] = message;
        else data.messages.push(message);
        persist();
      },
    },

    photos: {
      async findByDevice(deviceId: string) {
        return data.photos
          .filter((p) => p.device_id === deviceId)
          .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));
      },

      async findById(id: string) {
        return data.photos.find((p) => p.id === id) ?? null;
      },

      async save(photo: PhotoRow) {
        const idx = data.photos.findIndex((p) => p.id === photo.id);
        if (idx >= 0) data.photos[idx] = photo;
        else data.photos.push(photo);
        persist();
      },

      async updateLocalPath(id: string, localPath: string) {
        const photo = data.photos.find((p) => p.id === id);
        if (photo) {
          photo.local_cache_path = localPath;
          persist();
        }
      },
    },

    syncLogs: {
      async append(level: SyncLogRow['level'], message: string, eventType?: string) {
        data.sync_logs.unshift({
          id: data.next_log_id++,
          level,
          event_type: eventType ?? null,
          message,
          created_at: Date.now(),
        });
        if (data.sync_logs.length > 500) {
          data.sync_logs = data.sync_logs.slice(0, 500);
        }
        persist();
      },

      async findRecent(limit = 100) {
        return data.sync_logs.slice(0, limit);
      },
    },

    meta: {
      async get(key: string) {
        return data.meta[key] ?? null;
      },

      async set(key: string, value: string) {
        data.meta[key] = value;
        persist();
      },
    },
  };
}
