import { useState, useCallback } from 'react';
import {
  fetchDevices,
  fetchLogs,
  unpairDevice as unpairDeviceApi,
} from '@/services/desklinkApi';
import { useAppStore } from '@/store/appStore';

export function useUnpairDevice() {
  const setDevices = useAppStore((s) => s.setDevices);
  const setActiveDevice = useAppStore((s) => s.setActiveDevice);
  const setNotifications = useAppStore((s) => s.setNotifications);
  const setLogs = useAppStore((s) => s.setLogs);
  const setDeviceStatus = useAppStore((s) => s.setDeviceStatus);
  const setSummaryCounts = useAppStore((s) => s.setSummaryCounts);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [unpairingId, setUnpairingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestUnpair = useCallback((deviceId: string) => {
    setError(null);
    setConfirmId(deviceId);
  }, []);

  const cancelUnpair = useCallback(() => {
    setConfirmId(null);
    setError(null);
  }, []);

  const confirmUnpair = useCallback(async () => {
    if (!confirmId) return;

    setUnpairingId(confirmId);
    setError(null);
    try {
      await unpairDeviceApi(confirmId);
      const [devices, logs] = await Promise.all([fetchDevices(), fetchLogs()]);
      setDevices(devices);
      setActiveDevice(devices[0] ?? null);
      setNotifications([]);
      setLogs(logs);
      setDeviceStatus(null);
      setSummaryCounts({ notificationCount: 0, messageCount: 0, photoCount: 0 });
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unpair device');
    } finally {
      setUnpairingId(null);
    }
  }, [
    confirmId,
    setDevices,
    setActiveDevice,
    setNotifications,
    setLogs,
    setDeviceStatus,
    setSummaryCounts,
  ]);

  return {
    confirmId,
    unpairingId,
    error,
    requestUnpair,
    cancelUnpair,
    confirmUnpair,
  };
}
