import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, hashedPassword: string) {
  const [salt, storedHash] = hashedPassword.split(":");
  const derived = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");
  return timingSafeEqual(derived, storedBuffer);
}
