import { AsyncLocalStorage } from "node:async_hooks";

import type { NextFunction, Request, Response } from "express";

import { formatDayAs, type DateFormat } from "../../../src/lib/date-format-core";
import { DEFAULT_PREFERENCES, PREFS_COOKIE, decodeDevicePreferences } from "../../../src/lib/preferences";

/**
 * The date format of the person a request is being answered for, read from the same cookie the web app reads, so a date the API writes
 * into a page's text (a leave range, a register day) is written the way that person chose. Anything with no request around it — a
 * scheduled job, a message going to someone else — gets the default, never the format of whoever happened to trigger it.
 */
const requestFormat = new AsyncLocalStorage<DateFormat>();

export function dateFormatContext(request: Request, _response: Response, next: NextFunction) {
  const raw = request.headers.cookie?.split("; ").find((item) => item.startsWith(`${PREFS_COOKIE}=`))?.slice(PREFS_COOKIE.length + 1);
  requestFormat.run(decodeDevicePreferences(raw).dateFormat, next);
}

/** `date.toLocaleDateString(locale, options)` in the format of the person being answered. */
export const formatDay = (input: Date | string | number, options: Intl.DateTimeFormatOptions, locale = "en-GB") =>
  formatDayAs(requestFormat.getStore() ?? DEFAULT_PREFERENCES.dateFormat, input, options, locale);
