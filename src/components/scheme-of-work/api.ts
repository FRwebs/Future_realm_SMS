"use client";

export function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export async function schemeApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body || init?.method === "DELETE" || init?.method === "PATCH" || init?.method === "POST"
        ? {
            "Content-Type": "application/json",
            "x-csrf-token": getCookie("fr_csrf") ?? "",
          }
        : {}),
      ...init?.headers,
    },
  });

  const body = await response.json();
  if (!response.ok || body.ok === false || body.success === false) {
    const message =
      typeof body.message === "string"
        ? body.message
        : typeof body.error === "string"
          ? body.error
          : "Request failed.";
    throw new Error(message);
  }

  return body.data as T;
}
