/**
 * The two things every surface that writes to the API needs: the CSRF token
 * off the cookie, and a message a person can read out of whatever came back.
 *
 * Both started inside panel-renderer, which was fine while the form panel was
 * the only thing that wrote. The drawer now commits decisions too, and a second
 * copy of "turn a Zod issue array into a sentence" is how the two drift apart.
 */

import { enqueue, noConnection, offlineTarget } from "@/lib/offline/outbox";
import { readDevicePreferences } from "@/lib/preferences";

export function readCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

/**
 * A readable message out of whatever the API returned.
 *
 * A failed schema check comes back as a JSON array of Zod issues. Showing that
 * to somebody is not an error message, it is a stack trace with extra steps.
 */
/** What a reply that is not our JSON means: a gateway or host answering before the API did. */
export function statusMessage(status: number): string {
  if (status === 429) return "Too many requests were sent in a short time. Wait a minute and try again.";
  if (status === 502 || status === 503 || status === 504) return "The server is not answering right now. Try again in a moment.";
  if (status === 413) return "That is too large to send.";
  return "";
}

/** Reads a reply as JSON, or as the plain message of a gateway that answered instead of the API. */
export async function readReply<T extends { ok?: boolean; error?: string; message?: string }>(response: Response): Promise<T> {
  const raw = await response.text().catch(() => "");
  try {
    return JSON.parse(raw) as T;
  } catch {
    if (response.ok) return {} as T;
    return { ok: false, error: statusMessage(response.status) || raw.trim().slice(0, 140) || undefined } as T;
  }
}

export function readableError(raw: string | undefined): string {
  if (!raw) return "That did not save.";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return trimmed;

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const issues = Array.isArray(parsed) ? parsed : [parsed];
    const messages = issues
      .map((issue) => {
        if (!issue || typeof issue !== "object") return null;
        const { message, path } = issue as { message?: string; path?: unknown[] };
        if (!message) return null;
        const field = Array.isArray(path) && path.length ? String(path.at(-1)) : "";
        // "newPassword" reads as "New password" beside the box it belongs to.
        const label = field
          ? field
              .replace(/([A-Z])/g, (char) => ` ${char.toLowerCase()}`)
              .replace(/^./, (char) => char.toUpperCase())
          : "";
        return label ? `${label}: ${message}` : message;
      })
      .filter((message): message is string => Boolean(message));
    return messages.length ? messages.join(" · ") : trimmed;
  } catch {
    return trimmed;
  }
}

/**
 * With no connection, a register or a score sheet is held on the device instead of lost (see lib/offline/outbox). Anything
 * else needs a connection, and the error says so in words rather than "Failed to fetch".
 */
function heldOffline(endpoint: string, method: string, payload: unknown, cause: unknown): boolean {
  if (!noConnection(cause)) return false;
  const target = offlineTarget(endpoint, method);
  if (!target || !payload || typeof payload !== "object") return false;
  // Holding work on the device is the person's choice (Preferences); declined, an offline write is refused so nothing is left behind.
  if (!readDevicePreferences().keepOffline) return false;
  return Boolean(enqueue(target, payload as Record<string, unknown>, target.kind === "ATTENDANCE" ? "A register" : "Scores"));
}

const NO_CONNECTION = "There is no connection, and this needs one. Nothing was saved.";
const NOT_KEPT_OFFLINE = "There is no connection, and you have chosen not to keep work on this device (Preferences), so nothing was saved. Try again when you are connected.";

/** One write, with the CSRF header and the error handling both callers want. */
export async function sendJson(
  endpoint: string,
  method: string,
  payload: unknown,
): Promise<{ queued: boolean }> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": readCookie("fr_csrf") ?? "",
      },
      body: JSON.stringify(payload),
    });
  } catch (cause) {
    if (heldOffline(endpoint, method, payload, cause)) return { queued: true };
    throw noConnection(cause) ? new Error(offlineTarget(endpoint, method) && !readDevicePreferences().keepOffline ? NOT_KEPT_OFFLINE : NO_CONNECTION) : cause;
  }

  const result = await readReply<{ ok?: boolean; error?: string; message?: string }>(response);

  if (!response.ok || result.ok === false) {
    throw new Error(readableError(result.error ?? result.message));
  }
  return { queued: false };
}

/** The same write, handing back what the API answered with. */
export async function sendJsonForData<T>(endpoint: string, method: string, payload: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": readCookie("fr_csrf") ?? "",
      },
      body: JSON.stringify(payload),
    });
  } catch (cause) {
    if (heldOffline(endpoint, method, payload, cause)) {
      return { queued: true, fields: [["Held on", "This device"], ["Goes to the school", "By itself, the next time this device is online"], ["Until then", "The school's record does not have it yet"]], note: "Open the Sync tab to see what this device is holding, or to send it now." } as T;
    }
    throw noConnection(cause) ? new Error(NO_CONNECTION) : cause;
  }

  const result = await readReply<{ ok?: boolean; error?: string; message?: string; data?: T }>(response);

  if (!response.ok || result.ok === false) {
    throw new Error(readableError(result.error ?? result.message));
  }
  return result.data as T;
}
