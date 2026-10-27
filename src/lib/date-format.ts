import { cache } from "react";

import { formatDayAs, type DateFormat } from "@/lib/date-format-core";
import { DEFAULT_PREFERENCES, readDevicePreferences } from "@/lib/preferences";

/**
 * Every date the web app writes goes through here, so the way a person chose to read dates (Preferences → Date format) is honoured
 * everywhere at once. On the server the choice is the request's own: the first call to the API for a request notes it from the person's
 * cookie, and the page's data is always built after that call. In the browser it is read from the same cookie.
 */
const requestFormat = cache(() => ({ value: DEFAULT_PREFERENCES.dateFormat as DateFormat }));

export function noteRequestDateFormat(value: DateFormat) {
  requestFormat().value = value;
}

const chosen = (): DateFormat => (typeof window === "undefined" ? requestFormat().value : readDevicePreferences().dateFormat);

/** True when the person has not chosen another way to write dates (so a hand-written format may stay as it is). */
export const isDefaultDateFormat = () => chosen() === DEFAULT_PREFERENCES.dateFormat;

/** `date.toLocaleDateString(locale, options)` / `new Intl.DateTimeFormat(locale, options).format(date)`, in the person's date format. */
export const formatDay = (input: Date | string | number, options: Intl.DateTimeFormatOptions, locale = "en-GB") => formatDayAs(chosen(), input, options, locale);
