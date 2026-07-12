import { Bonjour, type Service } from 'bonjour-service';
import { pairingSessionManager } from '../security/pairing';
import type { IDatabaseManager } from '../storage/repositories';
import { getOrCreateDesktopIdentity } from '../security/identity';

const SERVICE_TYPE = 'desklink';

export class MdnsAdvertiser {
  private bonjour: Bonjour | null = null;
  private service: Service | null = null;
  private port = 9847;
  private desktopName: string;

  constructor(desktopName: string) {
    this.desktopName = desktopName;
  }

  start(port: number): void {
    this.port = port;
    if (this.bonjour) return;
    this.bonjour = new Bonjour();
    this.publish();
  }

  /** Republish TXT records (e.g. when pairing token changes). */
  refresh(): void {
    if (!this.bonjour) return;
    this.service?.stop();
    this.publish();
  }

  stop(): void {
    this.service?.stop();
    this.bonjour?.destroy();
    this.service = null;
    this.bonjour = null;
  }

  getServiceName(): string {
    return `DeskLink-${this.desktopName}`;
  }

  isAdvertising(): boolean {
    return this.bonjour !== null;
  }

  private publish(): void {
    if (!this.bonjour) return;

    const token = pairingSessionManager.getActiveToken();
    const txt: Record<string, string> = {
      version: '1',
      name: this.desktopName,
    };
    if (token) {
      txt.token = token;
    }

    this.service = this.bonjour.publish({
      name: this.getServiceName(),
      type: SERVICE_TYPE,
      port: this.port,
      txt,
    });
  }
}

let mdnsInstance: MdnsAdvertiser | null = null;

export async function initMdnsAdvertiser(
  db: IDatabaseManager,
  port: number,
): Promise<MdnsAdvertiser> {
  const identity = await getOrCreateDesktopIdentity(db);
  mdnsInstance = new MdnsAdvertiser(identity.desktopName);
  mdnsInstance.start(port);
  return mdnsInstance;
}

export function getMdnsAdvertiser(): MdnsAdvertiser | null {
  return mdnsInstance;
}

export function stopMdnsAdvertiser(): void {
  mdnsInstance?.stop();
  mdnsInstance = null;
}
