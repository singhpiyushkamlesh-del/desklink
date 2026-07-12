import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { PageHeader } from '@/components/PageLayout';
import {
  buildQrPayload,
  fetchNetworkInfo,
  fetchPairingStatus,
  startPairingSession,
  subscribePairingStatus,
} from '@/services/desklinkApi';
import { useAppStore } from '@/store/appStore';
import type { PairingStatusInfo } from '@/types';

const statusLabels: Record<PairingStatusInfo['status'], string> = {
  idle: 'Not started',
  waiting: 'Waiting for phone to scan…',
  pairing: 'Pairing in progress…',
  success: 'Paired successfully',
  error: 'Pairing failed',
  expired: 'Session expired',
};

export function PairDevicePage() {
  const setDevices = useAppStore((s) => s.setDevices);
  const setActiveDevice = useAppStore((s) => s.setActiveDevice);
  const setConnectionState = useAppStore((s) => s.setConnectionState);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<PairingStatusInfo>({ status: 'idle' });
  const [sessionInfo, setSessionInfo] = useState<{
    host: string;
    port: number;
    token: string;
    candidates?: { name: string; address: string }[];
    mdnsServiceName?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!window.desklink) return;
    const rows = await window.desklink.getDevices();
    const devices = rows.map((row) => ({
      id: row.id,
      deviceName: row.device_name,
      deviceModel: row.device_model,
      androidVersion: row.android_version,
      pairedAt: row.paired_at,
      lastSeen: row.last_seen,
      trusted: row.trusted === 1,
    }));
    setDevices(devices);
    setActiveDevice(devices[0] ?? null);
    if (devices.length > 0) {
      setConnectionState('paired');
    }
  }, [setDevices, setActiveDevice, setConnectionState]);

  const beginPairing = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await startPairingSession();
      const network = await fetchNetworkInfo();
      const payload = buildQrPayload({
        host: session.host,
        port: session.port,
        token: session.token,
        protocolVersion: session.protocolVersion,
      });
      const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
        width: 280,
        margin: 2,
      });
      setSessionInfo({
        host: session.host,
        port: session.port,
        token: session.token,
        candidates: network.candidates,
        mdnsServiceName: network.mdnsServiceName,
      });
      setQrDataUrl(dataUrl);
      setPairingStatus({ status: 'waiting' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start pairing session');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPairingStatus().then(setPairingStatus);
    const unsubscribe = subscribePairingStatus((status) => {
      setPairingStatus(status);
      if (status.status === 'success') {
        refreshDevices();
      }
    });
    beginPairing();
    return unsubscribe;
  }, [beginPairing, refreshDevices]);

  return (
    <div>
      <PageHeader
        title="Pair Device"
        description="Scan the QR code from your Android phone to connect securely over your local network."
        actions={
          <button
            type="button"
            onClick={beginPairing}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Refresh QR
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Pairing QR code</h3>
          <p className="mt-1 text-sm text-gray-500">
            Open DeskLink on your Android phone and tap Scan QR Code.
          </p>

          <div className="mt-6 flex flex-col items-center">
            {loading && <p className="text-sm text-gray-500">Generating QR code…</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {qrDataUrl && !loading && (
              <img src={qrDataUrl} alt="DeskLink pairing QR code" className="rounded-lg border border-gray-100" />
            )}
          </div>

          {sessionInfo && (
            <>
              {(sessionInfo.host === '127.0.0.1' || sessionInfo.host.startsWith('169.254.')) && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Could not detect a usable Wi‑Fi IP. Your phone may not reach this PC. Check that
                  you are on a private network and allow DeskLink through Windows Firewall. See{' '}
                  <code className="text-xs">docs/troubleshooting.md</code> in the repo.
                </div>
              )}
              <dl className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Host</dt>
                <dd className="font-mono text-gray-900">{sessionInfo.host}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Port</dt>
                <dd className="font-mono text-gray-900">{sessionInfo.port}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Token</dt>
                <dd className="max-w-[200px] truncate font-mono text-xs text-gray-700">{sessionInfo.token}</dd>
              </div>
            </dl>
              {sessionInfo.candidates && sessionInfo.candidates.length > 1 && (
                <div className="mt-4 text-xs text-gray-500">
                  <p className="font-medium text-gray-600">Other network adapters detected:</p>
                  <ul className="mt-1 list-inside list-disc">
                    {sessionInfo.candidates.slice(1, 4).map((c) => (
                      <li key={`${c.name}-${c.address}`}>
                        {c.name}: <span className="font-mono">{c.address}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Pairing status</h3>
            <p
              className={`mt-2 text-lg font-medium ${
                pairingStatus.status === 'success'
                  ? 'text-green-700'
                  : pairingStatus.status === 'error' || pairingStatus.status === 'expired'
                    ? 'text-red-600'
                    : 'text-gray-900'
              }`}
            >
              {statusLabels[pairingStatus.status]}
            </p>
            {pairingStatus.deviceName && pairingStatus.status === 'success' && (
              <p className="mt-2 text-sm text-gray-600">
                Connected to <strong>{pairingStatus.deviceName}</strong>
              </p>
            )}
            {pairingStatus.error && (
              <p className="mt-2 text-sm text-red-600">{pairingStatus.error}</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Instructions</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600">
              <li>Ensure your phone and PC are on the same Wi-Fi network.</li>
              <li>On Android, tap <strong>Find nearby desktops</strong> (or scan the QR below).</li>
              <li>On desktop, keep this app running — it advertises as{' '}
                <strong>{sessionInfo?.mdnsServiceName ?? 'DeskLink'}</strong> on the network.</li>
              <li>Wait for pairing confirmation on both devices.</li>
            </ol>
            <p className="mt-4 text-xs text-gray-400">
              The pairing token expires after 5 minutes. Tap Refresh QR to generate a new one.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
