export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'paired';

export interface ConnectionInfo {
  state: ConnectionState;
  serverState: 'stopped' | 'listening' | 'error';
  deviceId?: string | null;
}

export interface SmsThreadItem {
  id: string;
  deviceId: string;
  address: string;
  displayName: string | null;
  lastMessage: string | null;
  lastTimestamp: number | null;
}

export interface SmsMessageItem {
  id: string;
  threadId: string;
  address: string;
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp: number;
  status: string | null;
}

export interface PhotoItem {
  id: string;
  deviceId: string;
  fileName: string | null;
  mimeType: string | null;
  createdAt: number | null;
  thumbnailUrl: string | null;
  localPath: string | null;
}

export interface ClipboardSyncEvent {
  direction: 'inbound' | 'outbound';
  preview: string;
  timestamp: number;
}

export interface DeskLinkApi {
  getConnectionState: () => Promise<ConnectionInfo>;
  getDeviceStatus: () => Promise<LiveDeviceStatus | null>;
  getDevices: () => Promise<DeviceRow[]>;
  getNotifications: (deviceId?: string, query?: string) => Promise<NotificationItem[]>;
  getSmsThreads: (forceRefresh?: boolean) => Promise<SmsThreadItem[]>;
  getSmsMessages: (threadId: string, forceRefresh?: boolean) => Promise<SmsMessageItem[]>;
  sendSms: (payload: {
    threadId: string;
    address: string;
    body: string;
    clientMessageId: string;
  }) => Promise<{ success: boolean; clientMessageId: string }>;
  getPhotos: (forceRefresh?: boolean) => Promise<PhotoItem[]>;
  downloadPhoto: (photoId: string) => Promise<{ path: string; fileName: string }>;
  openPhoto: (filePath: string) => Promise<void>;
  getClipboardSyncEnabled: () => Promise<boolean>;
  setClipboardSyncEnabled: (enabled: boolean) => Promise<boolean>;
  unpairDevice: (deviceId: string) => Promise<{ success: boolean }>;
  getLogs: (limit?: number) => Promise<SyncLogRow[]>;
  getNetworkInfo: () => Promise<{
    localIp: string;
    port: number;
    candidates?: { name: string; address: string }[];
    mdnsServiceName?: string | null;
    mdnsAdvertising?: boolean;
    hasActivePairingToken?: boolean;
  }>;
  getPairingInfo: () => Promise<{
    host: string;
    port: number;
    token: string | null;
    hasActiveSession: boolean;
    protocolVersion: number;
  }>;
  getPairingStatus: () => Promise<PairingStatusInfo>;
  startPairingSession: () => Promise<{
    host: string;
    port: number;
    token: string;
    protocolVersion: number;
  }>;
  onPairingStatusChanged: (callback: (status: PairingStatusInfo) => void) => () => void;
  onConnectionStateChanged: (callback: (info: ConnectionInfo) => void) => () => void;
  onDeviceStatusChanged: (callback: (status: LiveDeviceStatus) => void) => () => void;
  onNotificationNew: (callback: (notification: NotificationItem) => void) => () => void;
  onClipboardUpdated: (callback: (event: ClipboardSyncEvent) => void) => () => void;
}

export interface NotificationItem {
  id: string;
  deviceId: string;
  appPackage: string | null;
  appName: string | null;
  title: string | null;
  body: string | null;
  timestamp: number;
}

export type PairingStatus = 'idle' | 'waiting' | 'pairing' | 'success' | 'error' | 'expired';

export interface PairingStatusInfo {
  status: PairingStatus;
  deviceName?: string;
  deviceId?: string;
  error?: string;
}

export interface DeviceRow {
  id: string;
  device_name: string;
  device_model: string | null;
  android_version: string | null;
  paired_at: number;
  last_seen: number | null;
  trusted: number;
}

export interface SyncLogRow {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  event_type: string | null;
  message: string;
  created_at: number;
}

export interface PairedDevice {
  id: string;
  deviceName: string;
  deviceModel: string | null;
  androidVersion: string | null;
  pairedAt: number;
  lastSeen: number | null;
  trusted: boolean;
}

export interface SyncLogEntry {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  eventType: string | null;
  message: string;
  createdAt: number;
}

export interface DeviceStatus {
  batteryPercent: number;
  isCharging: boolean;
  deviceModel: string;
  androidVersion: string;
  connectionState: ConnectionState;
  lastSyncTime: number | null;
}

export interface LiveDeviceStatus {
  deviceId: string;
  batteryPercent: number;
  isCharging: boolean;
  deviceModel: string;
  androidVersion: string;
  connectionState: ConnectionState;
  lastSyncTime: number;
}
