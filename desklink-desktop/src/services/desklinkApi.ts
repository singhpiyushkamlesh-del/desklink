import type { PairedDevice, PairingStatusInfo, SyncLogEntry, DeviceStatus, LiveDeviceStatus, ConnectionState, NotificationItem } from '@/types';

function mapDevice(row: {
  id: string;
  device_name: string;
  device_model: string | null;
  android_version: string | null;
  paired_at: number;
  last_seen: number | null;
  trusted: number;
}): PairedDevice {
  return {
    id: row.id,
    deviceName: row.device_name,
    deviceModel: row.device_model,
    androidVersion: row.android_version,
    pairedAt: row.paired_at,
    lastSeen: row.last_seen,
    trusted: row.trusted === 1,
  };
}

function mapLog(row: {
  id: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  event_type: string | null;
  message: string;
  created_at: number;
}): SyncLogEntry {
  return {
    id: row.id,
    level: row.level,
    eventType: row.event_type,
    message: row.message,
    createdAt: row.created_at,
  };
}

export async function fetchConnectionState() {
  if (!window.desklink) {
    return { state: 'disconnected' as const, serverState: 'stopped' as const };
  }
  return window.desklink.getConnectionState();
}

export async function fetchDevices(): Promise<PairedDevice[]> {
  if (!window.desklink) return [];
  const rows = await window.desklink.getDevices();
  return rows.map(mapDevice);
}

export async function unpairDevice(deviceId: string): Promise<void> {
  if (!window.desklink?.unpairDevice) {
    throw new Error('DeskLink API not available');
  }
  await window.desklink.unpairDevice(deviceId);
}

export async function fetchLogs(limit = 100): Promise<SyncLogEntry[]> {
  if (!window.desklink) return [];
  const rows = await window.desklink.getLogs(limit);
  return rows.map(mapLog);
}

export async function fetchNetworkInfo() {
  if (!window.desklink) {
    return { localIp: '127.0.0.1', port: 9847, candidates: [] as { name: string; address: string }[] };
  }
  return window.desklink.getNetworkInfo();
}

export async function fetchNotifications(deviceId?: string, query?: string): Promise<NotificationItem[]> {
  if (!window.desklink?.getNotifications) return [];
  return window.desklink.getNotifications(deviceId, query);
}

export function subscribeNotificationNew(callback: (notification: NotificationItem) => void) {
  if (!window.desklink?.onNotificationNew) return () => undefined;
  return window.desklink.onNotificationNew(callback);
}

export async function fetchDeviceStatus(): Promise<DeviceStatus | null> {
  if (!window.desklink?.getDeviceStatus) return null;
  const status = await window.desklink.getDeviceStatus();
  if (!status) return null;
  return mapDeviceStatus(status);
}

function mapDeviceStatus(status: LiveDeviceStatus): DeviceStatus {
  return {
    batteryPercent: status.batteryPercent,
    isCharging: status.isCharging,
    deviceModel: status.deviceModel,
    androidVersion: status.androidVersion,
    connectionState: status.connectionState,
    lastSyncTime: status.lastSyncTime,
  };
}

export function subscribeConnectionState(callback: (state: ConnectionState, serverState?: string) => void) {
  if (!window.desklink?.onConnectionStateChanged) return () => undefined;
  return window.desklink.onConnectionStateChanged((info) => {
    callback(info.state, info.serverState);
  });
}

export function subscribeDeviceStatus(callback: (status: DeviceStatus) => void) {
  if (!window.desklink?.onDeviceStatusChanged) return () => undefined;
  return window.desklink.onDeviceStatusChanged((live) => {
    callback(mapDeviceStatus(live));
  });
}

export async function startPairingSession() {
  if (!window.desklink) {
    throw new Error('DeskLink API not available');
  }
  return window.desklink.startPairingSession();
}

export async function fetchPairingStatus(): Promise<PairingStatusInfo> {
  if (!window.desklink) {
    return { status: 'idle' };
  }
  return window.desklink.getPairingStatus();
}

export function subscribePairingStatus(callback: (status: PairingStatusInfo) => void) {
  if (!window.desklink?.onPairingStatusChanged) {
    return () => undefined;
  }
  return window.desklink.onPairingStatusChanged(callback);
}

export interface QrPayload {
  host: string;
  port: number;
  token: string;
  version: number;
}

export function buildQrPayload(session: {
  host: string;
  port: number;
  token: string;
  protocolVersion: number;
}): QrPayload {
  return {
    host: session.host,
    port: session.port,
    token: session.token,
    version: session.protocolVersion,
  };
}
