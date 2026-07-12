import { randomUUID } from 'crypto';
import { hostname } from 'os';
import type { IDatabaseManager } from '../storage/repositories';
import { generateSessionToken } from '../security/pairing';

const DESKTOP_ID_KEY = 'desktop_id';
const DESKTOP_NAME_KEY = 'desktop_name';

export interface DesktopIdentity {
  desktopId: string;
  desktopName: string;
}

export async function getOrCreateDesktopIdentity(db: IDatabaseManager): Promise<DesktopIdentity> {
  let desktopId = await db.meta.get(DESKTOP_ID_KEY);
  let desktopName = await db.meta.get(DESKTOP_NAME_KEY);

  if (!desktopId) {
    desktopId = randomUUID();
    await db.meta.set(DESKTOP_ID_KEY, desktopId);
  }

  if (!desktopName) {
    desktopName = hostname();
    await db.meta.set(DESKTOP_NAME_KEY, desktopName);
  }

  return { desktopId, desktopName };
}

export async function savePairedDevice(
  db: IDatabaseManager,
  info: {
    deviceId: string;
    deviceName: string;
    deviceModel: string;
    androidVersion: string;
    sessionToken: string;
  },
): Promise<void> {
  const now = Date.now();
  await db.devices.save({
    id: info.deviceId,
    device_name: info.deviceName,
    device_model: info.deviceModel,
    android_version: info.androidVersion,
    paired_at: now,
    last_seen: now,
    trusted: 1,
    auth_token: info.sessionToken,
  });
  await db.syncLogs.append('info', `Paired with ${info.deviceName}`, 'pair:accepted');
}

export function createSessionToken(): string {
  return generateSessionToken();
}
