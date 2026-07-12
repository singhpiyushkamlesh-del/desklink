import { networkInterfaces } from 'os';

export interface NetworkCandidate {
  name: string;
  address: string;
  score: number;
}

const SKIP_INTERFACE =
  /(virtual|vmware|vethernet|hyper-v|loopback|tunnel|bluetooth|wsl|docker|npcap|hamachi|tailscale|zerotier|tap|tun|isatap)/i;

const PREFERRED_INTERFACE = /(wi-?fi|wlan|wireless|ethernet|^eth\d|^en\d)/i;

function scoreInterface(name: string, address: string): number {
  const lower = name.toLowerCase();

  if (address.startsWith('169.254.')) return -100;
  if (address.startsWith('127.')) return -100;
  if (SKIP_INTERFACE.test(lower)) return -50;
  if (PREFERRED_INTERFACE.test(lower)) return 100;
  return 10;
}

/** Ranked list of local IPv4 addresses suitable for LAN pairing. */
export function getLocalIpCandidates(): NetworkCandidate[] {
  const interfaces = networkInterfaces();
  const candidates: NetworkCandidate[] = [];

  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      candidates.push({
        name,
        address: entry.address,
        score: scoreInterface(name, entry.address),
      });
    }
  }

  return candidates
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

/** Discover the best local IPv4 address for LAN pairing. */
export function getLocalIpAddress(): string {
  return getLocalIpCandidates()[0]?.address ?? '127.0.0.1';
}
