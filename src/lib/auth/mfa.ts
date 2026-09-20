import { randomBytes } from "crypto";

import { authenticator } from "otplib";

const ISSUER = "FutureRealm SMS";
const BACKUP_CODE_COUNT = 8;

export function generateMfaSecret() {
  return authenticator.generateSecret();
}

export function buildOtpauthUri(accountEmail: string, secret: string) {
  return authenticator.keyuri(accountEmail, ISSUER, secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/** Plaintext, single-use recovery codes shown to the user once at enrollment (or regeneration). */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}
