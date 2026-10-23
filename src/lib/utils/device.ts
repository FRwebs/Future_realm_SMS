/**
 * What a session's device should read as: "Chrome · macOS" rather than the 120-character browser string it was recorded as.
 * Anything that is already a plain label ("Android app", "Shared tablet") is left alone.
 */
export function deviceLabel(raw: string | null | undefined): string {
  const text = (raw ?? "").trim();
  if (!text) return "—";
  if (!/Mozilla\/|AppleWebKit|Gecko|Chrome\/|Safari\/|curl\/|node/i.test(text)) return text;
  const browser = /Edg\//.test(text) ? "Edge" : /OPR\/|Opera/.test(text) ? "Opera" : /Firefox\//.test(text) ? "Firefox" : /Chrome\/|CriOS/.test(text) ? "Chrome" : /Safari\//.test(text) ? "Safari" : /curl/i.test(text) ? "curl" : "Browser";
  const os = /Windows/.test(text) ? "Windows" : /iPhone|iPad|iOS/.test(text) ? "iOS" : /Android/.test(text) ? "Android" : /Mac OS X|Macintosh/.test(text) ? "macOS" : /Linux|X11/.test(text) ? "Linux" : null;
  return os ? `${browser} · ${os}` : browser;
}
