import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { fetchNotifications, subscribeNotificationNew } from '@/services/desklinkApi';

export function useNotifications() {
  const activeDevice = useAppStore((s) => s.activeDevice);
  const notifications = useAppStore((s) => s.notifications);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const addNotification = useAppStore((s) => s.addNotification);

  const [searchQuery, setSearchQuery] = useState('');
  const [appFilter, setAppFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchNotifications(activeDevice?.id, searchQuery || undefined);
      setNotifications(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [activeDevice?.id, searchQuery, setNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const unsub = subscribeNotificationNew((notification) => {
      if (!activeDevice || notification.deviceId === activeDevice.id) {
        addNotification(notification);
      }
    });
    return () => unsub?.();
  }, [activeDevice, addNotification]);

  const appNames = Array.from(
    new Set(notifications.map((n) => n.appName ?? n.appPackage).filter(Boolean)),
  ).sort() as string[];

  const filtered = notifications.filter((n) => {
    if (appFilter === 'all') return true;
    return (n.appName ?? n.appPackage) === appFilter;
  });

  return {
    notifications: filtered,
    searchQuery,
    setSearchQuery,
    appFilter,
    setAppFilter,
    appNames,
    loading,
    error,
    refresh: loadNotifications,
  };
}
