import { ConnectionBadge } from './ConnectionBadge';
import { useAppStore } from '@/store/appStore';

export function TopBar() {
  const connectionState = useAppStore((s) => s.connectionState);
  const activeDevice = useAppStore((s) => s.activeDevice);

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div>
        <h2 className="text-sm font-medium text-gray-500">
          {activeDevice ? activeDevice.deviceName : 'No device paired'}
        </h2>
      </div>
      <ConnectionBadge state={connectionState} />
    </header>
  );
}
