import { PageHeader, EmptyState } from '@/components/PageLayout';
import { usePhotos } from '@/hooks/usePhotos';
import { openPhotoInFolder } from '@/services/photosApi';
import { useAppStore } from '@/store/appStore';

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PhotosPage() {
  const activeDevice = useAppStore((s) => s.activeDevice);
  const { photos, loading, downloadingId, error, loadPhotos, download, connectionState } =
    usePhotos();

  if (!activeDevice) {
    return (
      <div>
        <PageHeader
          title="Photos"
          description="Browse recent photos from your Android phone and download to your PC."
        />
        <EmptyState
          title="No paired device"
          description="Pair your Android phone first to browse photos from your desktop."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Photos"
        description={
          connectionState === 'connected'
            ? 'Recent photos from your phone. Tap download to save a full-resolution copy to your PC.'
            : 'Connect your phone to refresh the photo list and download images.'
        }
        actions={
          <button
            type="button"
            onClick={() => loadPhotos(true)}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && photos.length === 0 ? (
        <p className="text-sm text-gray-500">Loading photos from your phone…</p>
      ) : photos.length === 0 ? (
        <EmptyState
          title="No photos loaded"
          description="Tap Refresh to fetch recent photos from your Android device. Make sure photo sync is enabled and storage permission is granted on your phone."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {photos.map((photo) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              downloading={downloadingId === photo.id}
              onDownload={() => download(photo.id)}
              onOpen={() => photo.localPath && openPhotoInFolder(photo.localPath)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PhotoCardProps {
  photo: {
    id: string;
    fileName: string | null;
    createdAt: number | null;
    thumbnailUrl: string | null;
    localPath: string | null;
  };
  downloading: boolean;
  onDownload: () => void;
  onOpen: () => void;
}

function PhotoCard({ photo, downloading, onDownload, onOpen }: PhotoCardProps) {
  return (
    <div className="group overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="relative aspect-square bg-gray-100">
        {photo.thumbnailUrl ? (
          <img
            src={photo.thumbnailUrl}
            alt={photo.fileName ?? 'Photo'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            No preview
          </div>
        )}
        {photo.localPath && (
          <span className="absolute left-2 top-2 rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
            Saved
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium text-gray-900" title={photo.fileName ?? undefined}>
          {photo.fileName ?? 'Untitled'}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{formatDate(photo.createdAt)}</p>
        <div className="mt-2 flex gap-2">
          {photo.localPath ? (
            <button
              type="button"
              onClick={onOpen}
              className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Show in folder
            </button>
          ) : (
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className="flex-1 rounded-lg bg-desklink-accent px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {downloading ? 'Downloading…' : 'Download'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
