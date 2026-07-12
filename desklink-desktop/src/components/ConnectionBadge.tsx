import type { ConnectionState } from '@/types';

const stateConfig: Record<ConnectionState, { label: string; className: string }> = {
  connected: { label: 'Connected', className: 'bg-green-100 text-green-800' },
  connecting: { label: 'Connecting', className: 'bg-yellow-100 text-yellow-800' },
  paired: { label: 'Paired', className: 'bg-blue-100 text-blue-800' },
  disconnected: { label: 'Disconnected', className: 'bg-gray-200 text-gray-700' },
};

interface ConnectionBadgeProps {
  state: ConnectionState;
}

export function ConnectionBadge({ state }: ConnectionBadgeProps) {
  const config = stateConfig[state];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.className}`}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      {config.label}
    </span>
  );
}
