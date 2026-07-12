import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import {
  fetchConnectionState,
  fetchDeviceStatus,
  fetchDevices,
  fetchLogs,
  fetchNotifications,
  subscribeConnectionState,
  subscribeDeviceStatus,
  subscribeNotificationNew,
} from '@/services/desklinkApi';

export function useDeskLinkBootstrap() {
  const setConnectionState = useAppStore((s) => s.setConnectionState);
  const setDevices = useAppStore((s) => s.setDevices);
  const setActiveDevice = useAppStore((s) => s.setActiveDevice);
  const setLogs = useAppStore((s) => s.setLogs);
  const setDeviceStatus = useAppStore((s) => s.setDeviceStatus);
  const addNotification = useAppStore((s) => s.addNotification);
  const setNotifications = useAppStore((s) => s.setNotifications);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const [conn, devices, logs, status] = await Promise.all([
          fetchConnectionState(),
          fetchDevices(),
          fetchLogs(),
          fetchDeviceStatus(),
        ]);
        if (cancelled) return;
        setConnectionState(conn.state, conn.serverState);
        setDevices(devices);
        const active = devices[0] ?? null;
        setActiveDevice(active);
        setLogs(logs);
        setDeviceStatus(status);
        if (active) {
          const notifs = await fetchNotifications(active.id);
          if (!cancelled) setNotifications(notifs);
        }
      } catch {
        if (!cancelled) {
          setConnectionState('disconnected', 'stopped');
        }
      }
    }

    refresh();

    const unsubConn = subscribeConnectionState((state, serverState) => {
      setConnectionState(state, serverState as 'stopped' | 'listening' | 'error' | undefined);
    });

    const unsubStatus = subscribeDeviceStatus((status) => {
      setDeviceStatus(status);
    });

    const unsubNotif = subscribeNotificationNew((notification) => {
      addNotification(notification);
    });

    const interval = setInterval(refresh, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      unsubConn?.();
      unsubStatus?.();
      unsubNotif?.();
    };
  }, [setConnectionState, setDevices, setActiveDevice, setLogs, setDeviceStatus, addNotification, setNotifications]);
}
