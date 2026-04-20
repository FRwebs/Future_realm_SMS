"use client";

export function getCookie(name: string) {
  return document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")[1];
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body || init?.method === "DELETE" ? { "Content-Type": "application/json", "x-csrf-token": getCookie("fr_csrf") ?? "" } : {}),
      ...init?.headers,
    },
  });
  const body = await response.json();
  if (!response.ok || body.ok === false || body.success === false) {
    const message = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "Request failed.";
    throw new Error(message);
  }
  return body.data as T;
}

export function formatTime(time?: string | null) {
  if (!time) return "";
  const [hourPart, minute = "00"] = time.split(":");
  const hour = Number.parseInt(hourPart, 10);
  if (Number.isNaN(hour)) return time;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute}${suffix}`;
}
