/**
 * The two things every surface that writes to the API needs: the CSRF token
 * off the cookie, and a message a person can read out of whatever came back.
 *
 * Both started inside panel-renderer, which was fine while the form panel was
 * the only thing that wrote. The drawer now commits decisions too, and a second
 * copy of "turn a Zod issue array into a sentence" is how the two drift apart.
 */

import { enqueue, noConnection, offlineTarget } from "@/lib/offline/outbox";

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
  return Boolean(enqueue(target, payload as Record<string, unknown>, target.kind === "ATTENDANCE" ? "A register" : "Scores"));
}

const NO_CONNECTION = "There is no connection, and this needs one. Nothing was saved.";

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
    throw noConnection(cause) ? new Error(NO_CONNECTION) : cause;
  }

  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    message?: string;
  };

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

  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    message?: string;
    data?: T;
  };

  if (!response.ok || result.ok === false) {
    throw new Error(readableError(result.error ?? result.message));
  }
  return result.data as T;
}
