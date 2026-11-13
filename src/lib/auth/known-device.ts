/**
 * Who last signed in on this phone, kept only when they chose "Trust this device". The sign-in screen then greets them by name and asks
 * for the password alone. "Not you?" forgets it. Only a name and the address or User ID they typed are kept — never the password.
 */
const KEY = "fr:known-device";

export type KnownDevice = { identifier: string; name: string };

export function readKnownDevice(): KnownDevice | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<KnownDevice> | null;
    return value?.identifier && value.name ? { identifier: value.identifier, name: value.name } : null;
  } catch {
    return null;
  }
}

export function rememberKnownDevice(device: KnownDevice) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(device));
  } catch {
    /* a private window keeps nothing; the sign-in works the same without it */
  }
}

export function forgetKnownDevice() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing was kept */
  }
}

export const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "?";
