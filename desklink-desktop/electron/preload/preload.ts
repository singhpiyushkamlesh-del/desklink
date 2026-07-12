import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { ConnectionState } from '../shared/protocol';
import type { DeviceRow, SyncLogRow } from '../main/storage/schema';

export interface ConnectionInfo {
  state: ConnectionState;
  serverState: 'stopped' | 'listening' | 'error';
  deviceId?: string | null;
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

export interface NetworkInfo {
  localIp: string;
  port: number;
  candidates?: { name: string; address: string }[];
  mdnsServiceName?: string | null;
  mdnsAdvertising?: boolean;
  hasActivePairingToken?: boolean;
}

export interface PairingInfo {
  host: string;
  port: number;
  token: string | null;
  hasActiveSession: boolean;
  protocolVersion: number;
}

export type PairingStatus = 'idle' | 'waiting' | 'pairing' | 'success' | 'error' | 'expired';

export interface PairingStatusInfo {
  status: PairingStatus;
  deviceName?: string;
  deviceId?: string;
  error?: string;
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
  getNetworkInfo: () => Promise<NetworkInfo>;
  getPairingInfo: () => Promise<PairingInfo>;
  getPairingStatus: () => Promise<PairingStatusInfo>;
  startPairingSession: () => Promise<NetworkInfo & { token: string; protocolVersion: number }>;
  onPairingStatusChanged: (callback: (status: PairingStatusInfo) => void) => () => void;
  onConnectionStateChanged: (callback: (info: ConnectionInfo) => void) => () => void;
  onDeviceStatusChanged: (callback: (status: LiveDeviceStatus) => void) => () => void;
  onNotificationNew: (callback: (notification: NotificationItem) => void) => () => void;
  onClipboardUpdated: (callback: (event: ClipboardSyncEvent) => void) => () => void;
}

const desklinkApi: DeskLinkApi = {
  getConnectionState: () => ipcRenderer.invoke('desklink:get-connection-state'),
  getDeviceStatus: () => ipcRenderer.invoke('desklink:get-device-status'),
  getDevices: () => ipcRenderer.invoke('desklink:get-devices'),
  getNotifications: (deviceId, query) =>
    ipcRenderer.invoke('desklink:get-notifications', deviceId, query),
  getSmsThreads: (forceRefresh) => ipcRenderer.invoke('desklink:get-sms-threads', forceRefresh),
  getSmsMessages: (threadId, forceRefresh) =>
    ipcRenderer.invoke('desklink:get-sms-messages', threadId, forceRefresh),
  sendSms: (payload) => ipcRenderer.invoke('desklink:send-sms', payload),
  getPhotos: (forceRefresh) => ipcRenderer.invoke('desklink:get-photos', forceRefresh),
  downloadPhoto: (photoId) => ipcRenderer.invoke('desklink:download-photo', photoId),
  openPhoto: (filePath) => ipcRenderer.invoke('desklink:open-photo', filePath),
  getClipboardSyncEnabled: () => ipcRenderer.invoke('desklink:get-clipboard-sync-enabled'),
  setClipboardSyncEnabled: (enabled) =>
    ipcRenderer.invoke('desklink:set-clipboard-sync-enabled', enabled),
  unpairDevice: (deviceId) => ipcRenderer.invoke('desklink:unpair-device', deviceId),
  getLogs: (limit) => ipcRenderer.invoke('desklink:get-logs', limit),
  getNetworkInfo: () => ipcRenderer.invoke('desklink:get-network-info'),
  getPairingInfo: () => ipcRenderer.invoke('desklink:get-pairing-info'),
  getPairingStatus: () => ipcRenderer.invoke('desklink:get-pairing-status'),
  startPairingSession: () => ipcRenderer.invoke('desklink:start-pairing-session'),
  onPairingStatusChanged: (callback) => {
    const handler = (_event: IpcRendererEvent, status: PairingStatusInfo) => callback(status);
    ipcRenderer.on('desklink:pairing-status-changed', handler);
    return () => ipcRenderer.removeListener('desklink:pairing-status-changed', handler);
  },
  onConnectionStateChanged: (callback) => {
    const handler = (_event: IpcRendererEvent, info: ConnectionInfo) => callback(info);
    ipcRenderer.on('desklink:connection-state-changed', handler);
    return () => ipcRenderer.removeListener('desklink:connection-state-changed', handler);
  },
  onDeviceStatusChanged: (callback) => {
    const handler = (_event: IpcRendererEvent, status: LiveDeviceStatus) => callback(status);
    ipcRenderer.on('desklink:device-status-changed', handler);
    return () => ipcRenderer.removeListener('desklink:device-status-changed', handler);
  },
  onNotificationNew: (callback) => {
    const handler = (_event: IpcRendererEvent, notification: NotificationItem) =>
      callback(notification);
    ipcRenderer.on('desklink:notification-new', handler);
    return () => ipcRenderer.removeListener('desklink:notification-new', handler);
  },
  onClipboardUpdated: (callback) => {
    const handler = (_event: IpcRendererEvent, event: ClipboardSyncEvent) => callback(event);
    ipcRenderer.on('desklink:clipboard-updated', handler);
    return () => ipcRenderer.removeListener('desklink:clipboard-updated', handler);
  },
};

contextBridge.exposeInMainWorld('desklink', desklinkApi);
