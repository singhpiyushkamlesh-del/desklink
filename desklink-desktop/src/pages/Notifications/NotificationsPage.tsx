import { PageHeader, EmptyState } from '@/components/PageLayout';
import { useNotifications } from '@/hooks/useNotifications';
import { useAppStore } from '@/store/appStore';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function NotificationsPage() {
  const activeDevice = useAppStore((s) => s.activeDevice);
  const connectionState = useAppStore((s) => s.connectionState);
  const {
    notifications,
    searchQuery,
    setSearchQuery,
    appFilter,
    setAppFilter,
    appNames,
    loading,
    error,
    refresh,
  } = useNotifications();

  if (!activeDevice) {
    return (
      <div>
        <PageHeader title="Notifications" description="Live feed of notifications from your Android phone." />
        <EmptyState
          title="No paired device"
          description="Pair your Android phone first to receive notifications on your desktop."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={
          connectionState === 'connected'
            ? 'Receiving notifications in real time from your phone.'
            : 'Notifications will sync when your phone reconnects.'
        }
        actions={
          <button
            type="button"
            onClick={refresh}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by app, title, or body…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-[240px] flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-desklink-accent focus:outline-none focus:ring-1 focus:ring-desklink-accent"
        />
        <select
          value={appFilter}
          onChange={(e) => setAppFilter(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700"
        >
          <option value="all">All apps</option>
          {appNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {loading && notifications.length === 0 ? (
        <p className="text-sm text-gray-500">Loading notifications…</p>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Post a notification on your Android phone (with notification access enabled for DeskLink) and it will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-desklink-accent/10 px-2.5 py-0.5 text-xs font-medium text-desklink-accent">
                      {n.appName ?? n.appPackage ?? 'Unknown app'}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(n.timestamp)}</span>
                  </div>
                  <p className="mt-2 font-medium text-gray-900">{n.title}</p>
                  {n.body && <p className="mt-1 text-sm text-gray-600">{n.body}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
