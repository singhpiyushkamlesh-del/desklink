import { useCallback, useEffect, useState } from 'react';
import { getClipboardSyncEnabled, setClipboardSyncEnabled } from '@/services/settingsApi';
import type { ClipboardSyncEvent } from '@/types';

export function useClipboardSettings() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastEvent, setLastEvent] = useState<ClipboardSyncEvent | null>(null);

  useEffect(() => {
    getClipboardSyncEnabled()
      .then(setEnabled)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!window.desklink?.onClipboardUpdated) return undefined;
    return window.desklink.onClipboardUpdated((event) => setLastEvent(event));
  }, []);

  const toggle = useCallback(async (next: boolean) => {
    setEnabled(next);
    try {
      const saved = await setClipboardSyncEnabled(next);
      setEnabled(saved);
    } catch {
      setEnabled((prev) => !next);
    }
  }, []);

  return { enabled, loading, lastEvent, toggle };
}
