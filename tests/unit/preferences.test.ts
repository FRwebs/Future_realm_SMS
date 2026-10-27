// @vitest-environment jsdom
import { DEFAULT_PREFERENCES, PREFS_COOKIE, decodeDevicePreferences, devicePreferencesFrom, encodeDevicePreferences, landingPathFor, preferencesSchema, readDevicePreferences } from "@/lib/preferences";
import { sendJson } from "@/lib/modules/submit";
import { OUTBOX_KEYS } from "@/lib/offline/outbox";

describe("a person's own settings", () => {
  it("lands where they asked, and nowhere strange when they did not", () => {
    expect(landingPathFor({ openOn: "Approvals · Queue" })).toBe("/approvals-workflow/queue");
    expect(landingPathFor({})).toBeNull();
    expect(landingPathFor(null)).toBeNull();
  });

  it("refuses a destination or density the product does not offer", () => {
    expect(preferencesSchema.safeParse({ openOn: "Somewhere else" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ density: "Huge" }).success).toBe(false);
    expect(preferencesSchema.safeParse({ density: "Comfortable", confirmLeave: false }).success).toBe(true);
    expect(preferencesSchema.safeParse({}).success).toBe(true);
  });

  it("carries the device-level choices in a cookie, and falls back to the usual behaviour when it is missing or damaged", () => {
    const value = devicePreferencesFrom({ density: "Comfortable", confirmLeave: false, keepOffline: false, dateFormat: "4 Sep 2026" });
    expect(decodeDevicePreferences(encodeDevicePreferences(value))).toEqual(value);
    expect(decodeDevicePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(decodeDevicePreferences("%7Bnot json")).toEqual(DEFAULT_PREFERENCES);
    expect(devicePreferencesFrom(null)).toEqual(DEFAULT_PREFERENCES);
  });

  it("is read from the browser's cookie", () => {
    document.cookie = `${PREFS_COOKIE}=${encodeDevicePreferences({ density: "Comfortable", confirmLeave: true, keepOffline: false, dateFormat: "4 Sep 2026" })}; path=/`;
    expect(readDevicePreferences()).toEqual({ density: "Comfortable", confirmLeave: true, keepOffline: false, dateFormat: "4 Sep 2026" });
    document.cookie = `${PREFS_COOKIE}=; path=/; max-age=0`;
  });
});

describe("working offline, as the person chose", () => {
  const registerEndpoint = "/api/v1/attendance-management/mark/class1/submit";
  const goOffline = () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
  };
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
    document.cookie = `${PREFS_COOKIE}=; path=/; max-age=0`;
    localStorage.clear();
  });

  it("holds a register on the device while offline, by default", async () => {
    goOffline();
    await expect(sendJson(registerEndpoint, "POST", { marks: [] })).resolves.toEqual({ queued: true });
    expect(localStorage.getItem(OUTBOX_KEYS.ATTENDANCE)).not.toBeNull();
  });

  it("refuses it, saying why, when the person asked for nothing to be kept on the device", async () => {
    document.cookie = `${PREFS_COOKIE}=${encodeDevicePreferences({ density: "Compact", confirmLeave: true, keepOffline: false, dateFormat: "4 Sep 2026" })}; path=/`;
    goOffline();
    await expect(sendJson(registerEndpoint, "POST", { marks: [] })).rejects.toThrow(/chosen not to keep work on this device/);
    expect(localStorage.getItem(OUTBOX_KEYS.ATTENDANCE)).toBeNull();
  });
});

describe("date format", () => {
  it("leaves dates as they have always been written until one is chosen", async () => {
    const { formatDay } = await import("@/lib/date-format");
    expect(formatDay("2026-09-04T12:00:00Z", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })).toBe("4 Sept 2026");
  });

  it("writes every shape of date in the chosen format, keeping weekday and time in place", async () => {
    const { formatDay } = await import("@/lib/date-format");
    const at = "2026-09-04T14:05:00Z";
    document.cookie = `${PREFS_COOKIE}=${encodeDevicePreferences({ density: "Compact", confirmLeave: true, keepOffline: true, dateFormat: "04/09/2026" })}; path=/`;
    expect(formatDay(at, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })).toBe("04/09/2026");
    expect(formatDay(at, { day: "numeric", month: "short", timeZone: "UTC" })).toBe("04/09");
    expect(formatDay(at, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })).toBe("Fri, 04/09");
    expect(formatDay(at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })).toBe("04/09 14:05");
    document.cookie = `${PREFS_COOKIE}=${encodeDevicePreferences({ density: "Compact", confirmLeave: true, keepOffline: true, dateFormat: "2026-09-04" })}; path=/`;
    expect(formatDay(at, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })).toBe("2026-09-04");
    document.cookie = `${PREFS_COOKIE}=${encodeDevicePreferences({ density: "Compact", confirmLeave: true, keepOffline: true, dateFormat: "09/04/2026" })}; path=/`;
    expect(formatDay(at, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })).toBe("09/04/2026");
  });
});
