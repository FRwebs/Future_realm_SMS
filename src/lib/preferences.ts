import { z } from "zod";

/**
 * A person's own settings — how the product opens and behaves for them, never for anyone else. One definition, shared by the page that
 * edits them, the API that stores them, and the code that obeys them, so a choice offered is a choice that can be honoured.
 */

/** Where a person may ask to land after signing in, by what the menu calls it. */
export const OPEN_ON = {
  "Command Center · Today": "/command-center/today",
  "Command Center · Oversight": "/command-center/oversight",
  "Approvals · Queue": "/approvals-workflow/queue",
  "Attendance · Mark": "/attendance/mark",
  "Score Entry · Review": "/score-entry-results/review",
} as const;
export const OPEN_ON_CHOICES = Object.keys(OPEN_ON) as Array<keyof typeof OPEN_ON>;

export const DENSITIES = ["Compact", "Comfortable"] as const;
export const QUIET_HOURS = ["None", "19:00 – 07:00 WAT", "21:00 – 06:00 WAT"] as const;
export const NOTIFY_ABOUT = [
  "An approval routed to me",
  "An item escalating past me",
  "A returned submission of mine",
  "A sync failure on my device",
  "A sensitive record being opened",
  "Weekly oversight summary",
] as const;
export const NOTIFY_BY = ["In-app", "Email", "SMS"] as const;

export const preferencesSchema = z
  .object({
    openOn: z.enum(OPEN_ON_CHOICES as [keyof typeof OPEN_ON, ...Array<keyof typeof OPEN_ON>]),
    density: z.enum(DENSITIES),
    confirmLeave: z.boolean(),
    keepOffline: z.boolean(),
    notifyAbout: z.array(z.enum(NOTIFY_ABOUT)),
    notifyBy: z.array(z.enum(NOTIFY_BY)),
    quietHours: z.enum(QUIET_HOURS),
  })
  .partial();
export type Preferences = z.infer<typeof preferencesSchema>;

/** What a person gets until they choose: the product as it has always been. */
export const DEFAULT_PREFERENCES: Required<Pick<Preferences, "density" | "confirmLeave" | "keepOffline">> = { density: "Compact", confirmLeave: true, keepOffline: true };

/** The page a person asked to open on, if they asked for one. */
export function landingPathFor(preferences: Preferences | null | undefined): string | null {
  return preferences?.openOn ? OPEN_ON[preferences.openOn] : null;
}

/** The few choices that change what the browser does by itself — kept in a cookie so the page can obey them before any request is made. */
export const PREFS_COOKIE = "fr_prefs";
export type DevicePreferences = typeof DEFAULT_PREFERENCES;

export function devicePreferencesFrom(preferences: Preferences | null | undefined): DevicePreferences {
  return {
    density: preferences?.density ?? DEFAULT_PREFERENCES.density,
    confirmLeave: preferences?.confirmLeave ?? DEFAULT_PREFERENCES.confirmLeave,
    keepOffline: preferences?.keepOffline ?? DEFAULT_PREFERENCES.keepOffline,
  };
}

export const encodeDevicePreferences = (value: DevicePreferences) => encodeURIComponent(JSON.stringify(value));

export function decodeDevicePreferences(raw: string | undefined | null): DevicePreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<DevicePreferences>;
    return {
      density: parsed.density === "Comfortable" ? "Comfortable" : "Compact",
      confirmLeave: parsed.confirmLeave !== false,
      keepOffline: parsed.keepOffline !== false,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** In the browser: what this device has been told to do. Safe to call anywhere a window exists; elsewhere it gives the defaults. */
export function readDevicePreferences(): DevicePreferences {
  if (typeof document === "undefined") return DEFAULT_PREFERENCES;
  const raw = document.cookie.split("; ").find((item) => item.startsWith(`${PREFS_COOKIE}=`))?.split("=")[1];
  return decodeDevicePreferences(raw);
}
