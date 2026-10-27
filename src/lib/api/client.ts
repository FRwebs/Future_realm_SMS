/**
 * Reading from the API in the browser. One place knows how a failure is worded, so every query shows the same message the server gave.
 * Writes keep using their own `fetch` because each needs the CSRF header and its own wording.
 */
export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { credentials: "include", headers: { Accept: "application/json" }, signal });
  let body: { ok?: boolean; success?: boolean; data?: T; error?: string; message?: string } | null = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok || body?.ok === false || body?.success === false) {
    throw new ApiRequestError(body?.error ?? body?.message ?? "The request did not go through.", response.status);
  }
  return (body?.data ?? null) as T;
}
