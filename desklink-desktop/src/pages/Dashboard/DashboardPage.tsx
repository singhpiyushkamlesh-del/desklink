import { PageHeader, EmptyState } from '@/components/PageLayout';
import { useAppStore } from '@/store/appStore';

function SummaryCard({ label, value, subtext }: { label: string; value: number | string; subtext?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      {subtext && <p className="mt-1 text-xs text-gray-400">{subtext}</p>}
    </div>
  );
}

function formatLastSync(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Never';
  return new Date(timestamp).toLocaleString();
}

export function DashboardPage() {
  const activeDevice = useAppStore((s) => s.activeDevice);
  const deviceStatus = useAppStore((s) => s.deviceStatus);
  const notificationCount = useAppStore((s) => s.notificationCount);
  const messageCount = useAppStore((s) => s.messageCount);
  const photoCount = useAppStore((s) => s.photoCount);
  const connectionState = useAppStore((s) => s.connectionState);

  if (!activeDevice) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Overview of your paired phone and sync status." />
        <EmptyState
          title="No paired device"
          description="Pair your Android phone from the Pair Device page to see device status and sync summaries here."
        />
      </div>
    );
  }

  const isLive = connectionState === 'connected';
  const battery = deviceStatus?.batteryPercent;
  const charging = deviceStatus?.isCharging;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          isLive
            ? `Live sync with ${activeDevice.deviceName}`
            : `Paired with ${activeDevice.deviceName} — waiting for connection`
        }
      />

      {connectionState !== 'connected' && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your phone is not connected. Open DeskLink on your Android device and ensure both devices
          are on the same Wi‑Fi network.
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Connection"
          value={connectionState}
          subtext={isLive ? 'Phone is connected' : 'Open DeskLink on your phone'}
        />
        <SummaryCard
          label="Battery"
          value={battery != null ? `${battery}%` : '—'}
          subtext={charging != null ? (charging ? 'Charging' : 'Not charging') : undefined}
        />
        <SummaryCard
          label="Device model"
          value={deviceStatus?.deviceModel ?? activeDevice.deviceModel ?? '—'}
        />
        <SummaryCard
          label="Android version"
          value={deviceStatus?.androidVersion ?? activeDevice.androidVersion ?? '—'}
        />
      </div>

      <div className="mb-6">
        <SummaryCard
          label="Last sync"
          value={formatLastSync(deviceStatus?.lastSyncTime ?? activeDevice.lastSeen)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Notifications" value={notificationCount} />
        <SummaryCard label="Messages" value={messageCount} />
        <SummaryCard label="Photos" value={photoCount} />
      </div>
    </div>
  );
}
