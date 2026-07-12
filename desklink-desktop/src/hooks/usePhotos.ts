import { useCallback, useEffect, useState } from 'react';
import { downloadPhoto, fetchPhotos } from '@/services/photosApi';
import type { PhotoItem } from '@/types';
import { useAppStore } from '@/store/appStore';

export function usePhotos() {
  const connectionState = useAppStore((s) => s.connectionState);
  const setSummaryCounts = useAppStore((s) => s.setSummaryCounts);

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPhotos = useCallback(async (forceRefresh = true) => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchPhotos(forceRefresh);
      setPhotos(items);
      setSummaryCounts({ photoCount: items.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setLoading(false);
    }
  }, [setSummaryCounts]);

  useEffect(() => {
    loadPhotos(true);
  }, [loadPhotos, connectionState]);

  const download = useCallback(async (photoId: string) => {
    setDownloadingId(photoId);
    setError(null);
    try {
      const result = await downloadPhoto(photoId);
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, localPath: result.path } : p)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download photo');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return {
    photos,
    loading,
    downloadingId,
    error,
    loadPhotos,
    download,
    connectionState,
  };
}
