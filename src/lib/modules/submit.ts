/**
 * The two things every surface that writes to the API needs: the CSRF token
 * off the cookie, and a message a person can read out of whatever came back.
 *
 * Both started inside panel-renderer, which was fine while the form panel was
 * the only thing that wrote. The drawer now commits decisions too, and a second
 * copy of "turn a Zod issue array into a sentence" is how the two drift apart.
 */

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

/** One write, with the CSRF header and the error handling both callers want. */
export async function sendJson(
  endpoint: string,
  method: string,
  payload: unknown,
): Promise<void> {
  const response = await fetch(endpoint, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": readCookie("fr_csrf") ?? "",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    message?: string;
  };

  if (!response.ok || result.ok === false) {
    throw new Error(readableError(result.error ?? result.message));
  }
}
