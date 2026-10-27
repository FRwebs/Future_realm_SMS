import { DATE_FORMATS, DEFAULT_PREFERENCES } from "@/lib/preferences";

/**
 * How a date is written in each of the formats a person may choose (Preferences → Date format). With the default it is exactly what
 * `Intl.DateTimeFormat("en-GB", …)` has always written. Shared by the web app and the API, each of which knows the person's choice its own way.
 */
export type DateFormat = (typeof DATE_FORMATS)[number];

export function formatDayAs(format: DateFormat, input: Date | string | number, options: Intl.DateTimeFormatOptions, locale = "en-GB"): string {
  const date = input instanceof Date ? input : new Date(input);
  const written = new Intl.DateTimeFormat(locale, options);
  if (format === DEFAULT_PREFERENCES.dateFormat || Number.isNaN(date.getTime()) || !options.day || !options.month) return written.format(date);

  // Rebuild the date part from its pieces; the weekday and the time, if asked for, keep their place around it.
  const numeric = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: options.timeZone }).formatToParts(date);
  const pick = (type: string) => numeric.find((part) => part.type === type)?.value ?? "";
  const [day, month, year] = [pick("day"), pick("month"), pick("year")];
  const core =
    format === "04/09/2026" ? (options.year ? `${day}/${month}/${year}` : `${day}/${month}`)
    : format === "09/04/2026" ? (options.year ? `${month}/${day}/${year}` : `${month}/${day}`)
    : options.year ? `${year}-${month}-${day}` : `${month}-${day}`;

  const parts = written.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = parts.find((part) => part.type === "hour");
  const minute = parts.find((part) => part.type === "minute");
  const dayPeriod = parts.find((part) => part.type === "dayPeriod")?.value;
  const time = hour && minute ? `${hour.value}:${minute.value}${dayPeriod ? ` ${dayPeriod}` : ""}` : "";
  return [weekday ? `${weekday},` : "", core, time].filter(Boolean).join(" ");
}
