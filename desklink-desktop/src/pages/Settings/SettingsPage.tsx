import { PageHeader, EmptyState } from '@/components/PageLayout';
import { useClipboardSettings } from '@/hooks/useClipboardSettings';
import { useUnpairDevice } from '@/hooks/useUnpairDevice';
import { useAppStore } from '@/store/appStore';

function formatSyncTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function SettingsPage() {
  const devices = useAppStore((s) => s.devices);
  const logs = useAppStore((s) => s.logs);
  const connectionState = useAppStore((s) => s.connectionState);
  const { enabled: clipboardSync, loading: clipboardLoading, lastEvent, toggle } =
    useClipboardSettings();
  const {
    confirmId,
    unpairingId,
    error: unpairError,
    requestUnpair,
    cancelUnpair,
    confirmUnpair,
  } = useUnpairDevice();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage paired devices, sync preferences, and view connection logs."
      />
      <div className="space-y-6">
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Sync preferences</h3>
          <div className="mt-4 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-gray-900">Clipboard sync</p>
              <p className="text-sm text-gray-500">
                Copy text on your PC or phone and it appears on the other device. Plain text only.
              </p>
              {lastEvent && (
                <p className="mt-2 text-xs text-gray-400">
                  Last sync ({lastEvent.direction === 'inbound' ? 'from phone' : 'to phone'}):{' '}
                  {lastEvent.preview || '(empty)'} — {formatSyncTime(lastEvent.timestamp)}
                </p>
              )}
              {connectionState !== 'connected' && (
                <p className="mt-1 text-xs text-amber-600">
                  Phone must be connected for clipboard sync.
                </p>
              )}
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={clipboardSync}
                disabled={clipboardLoading}
                onChange={(e) => toggle(e.target.checked)}
              />
              <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-desklink-accent peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:opacity-50" />
            </label>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Notification, SMS, photo, and clipboard sync toggles for your phone are managed in the
            DeskLink Android app Home screen.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Paired devices</h3>
          {unpairError && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {unpairError}
            </div>
          )}
          {devices.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No paired devices yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{d.deviceName}</p>
                    <p className="text-xs text-gray-500">{d.deviceModel}</p>
                  </div>
                  {confirmId === d.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Unpair?</span>
                      <button
                        type="button"
                        onClick={confirmUnpair}
                        disabled={unpairingId === d.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {unpairingId === d.id ? 'Removing…' : 'Yes'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelUnpair}
                        disabled={unpairingId === d.id}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => requestUnpair(d.id)}
                      disabled={unpairingId !== null}
                      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                    >
                      Unpair
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Android permissions</h3>
          <p className="mt-2 text-sm text-gray-500">
            Grant permissions on your phone via the DeskLink app → Permissions screen. Required
            items: notification access, SMS, photos/media, camera (for QR pairing), and battery
            optimization exclusion for reliable background sync.
          </p>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Sync logs</h3>
          {logs.length === 0 ? (
            <EmptyState
              title="No logs"
              description="Connection and sync logs will appear here."
            />
          ) : (
            <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
              {logs.map((log) => (
                <li key={log.id} className="text-gray-600">
                  [{log.level}] {log.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
