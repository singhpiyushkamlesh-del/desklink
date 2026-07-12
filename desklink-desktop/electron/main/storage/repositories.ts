import type {
  DeviceRow,
  MessageRow,
  MessageThreadRow,
  NotificationRow,
  PhotoRow,
  SyncLogRow,
} from './schema';

/** Repository interfaces — implementations wired in later stages. */

export interface IDeviceRepository {
  findAll(): Promise<DeviceRow[]>;
  findById(id: string): Promise<DeviceRow | null>;
  findByAuthToken(token: string): Promise<DeviceRow | null>;
  save(device: DeviceRow): Promise<void>;
  remove(id: string): Promise<void>;
  updateLastSeen(id: string, timestamp: number): Promise<void>;
}

export interface INotificationRepository {
  findByDevice(deviceId: string, limit?: number): Promise<NotificationRow[]>;
  save(notification: NotificationRow): Promise<void>;
  search(deviceId: string, query: string): Promise<NotificationRow[]>;
}

export interface IMessageRepository {
  findThreads(deviceId: string): Promise<MessageThreadRow[]>;
  findMessages(threadId: string): Promise<MessageRow[]>;
  saveThread(thread: MessageThreadRow): Promise<void>;
  saveMessage(message: MessageRow): Promise<void>;
}

export interface IPhotoRepository {
  findByDevice(deviceId: string): Promise<PhotoRow[]>;
  findById(id: string): Promise<PhotoRow | null>;
  save(photo: PhotoRow): Promise<void>;
  updateLocalPath(id: string, localPath: string): Promise<void>;
}

export interface ISyncLogRepository {
  append(
    level: SyncLogRow['level'],
    message: string,
    eventType?: string,
  ): Promise<void>;
  findRecent(limit?: number): Promise<SyncLogRow[]>;
}

export interface IMetaRepository {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface IDatabaseManager {
  initialize(): Promise<void>;
  close(): void;
  purgeDeviceData(deviceId: string): Promise<void>;
  devices: IDeviceRepository;
  notifications: INotificationRepository;
  messages: IMessageRepository;
  photos: IPhotoRepository;
  syncLogs: ISyncLogRepository;
  meta: IMetaRepository;
}
