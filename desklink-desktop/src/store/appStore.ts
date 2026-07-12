import { create } from 'zustand';
import type { ConnectionState, DeviceStatus, NotificationItem, PairedDevice, SyncLogEntry } from '@/types';

interface AppState {
  connectionState: ConnectionState;
  serverState: 'stopped' | 'listening' | 'error';
  activeDevice: PairedDevice | null;
  devices: PairedDevice[];
  deviceStatus: DeviceStatus | null;
  notifications: NotificationItem[];
  logs: SyncLogEntry[];
  notificationCount: number;
  messageCount: number;
  photoCount: number;

  setConnectionState: (state: ConnectionState, serverState?: AppState['serverState']) => void;
  setActiveDevice: (device: PairedDevice | null) => void;
  setDevices: (devices: PairedDevice[]) => void;
  setDeviceStatus: (status: DeviceStatus | null) => void;
  setNotifications: (notifications: NotificationItem[]) => void;
  addNotification: (notification: NotificationItem) => void;
  setLogs: (logs: SyncLogEntry[]) => void;
  setSummaryCounts: (counts: Partial<Pick<AppState, 'notificationCount' | 'messageCount' | 'photoCount'>>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  connectionState: 'disconnected',
  serverState: 'stopped',
  activeDevice: null,
  devices: [],
  deviceStatus: null,
  notifications: [],
  logs: [],
  notificationCount: 0,
  messageCount: 0,
  photoCount: 0,

  setConnectionState: (connectionState, serverState) =>
    set((s) => ({
      connectionState,
      serverState: serverState ?? s.serverState,
    })),
  setActiveDevice: (activeDevice) => set({ activeDevice }),
  setDevices: (devices) => set({ devices }),
  setDeviceStatus: (deviceStatus) => set({ deviceStatus }),
  setNotifications: (notifications) =>
    set({ notifications, notificationCount: notifications.length }),
  addNotification: (notification) =>
    set((s) => {
      const exists = s.notifications.some((n) => n.id === notification.id);
      const notifications = exists
        ? s.notifications.map((n) => (n.id === notification.id ? notification : n))
        : [notification, ...s.notifications];
      return { notifications, notificationCount: notifications.length };
    }),
  setLogs: (logs) => set({ logs }),
  setSummaryCounts: (counts) => set((s) => ({ ...s, ...counts })),
}));
