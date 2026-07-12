import { randomBytes } from 'crypto';

/** Generate a cryptographically random pairing token (hex). */
export function generatePairingToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** Generate a session token for trusted device auth. */
export function generateSessionToken(): string {
  return randomBytes(48).toString('hex');
}

/** Pairing session manager — short-lived tokens for QR pairing. */
export class PairingSessionManager {
  private activeToken: string | null = null;
  private expiresAt = 0;

  startSession(ttlMs = 5 * 60 * 1000): string {
    this.activeToken = generatePairingToken(16);
    this.expiresAt = Date.now() + ttlMs;
    return this.activeToken;
  }

  getActiveToken(): string | null {
    if (!this.activeToken || Date.now() > this.expiresAt) {
      return null;
    }
    return this.activeToken;
  }

  validateToken(token: string): boolean {
    return this.getActiveToken() === token;
  }

  clearSession(): void {
    this.activeToken = null;
    this.expiresAt = 0;
  }
}

export const pairingSessionManager = new PairingSessionManager();
