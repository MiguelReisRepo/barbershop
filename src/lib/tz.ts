import { fromZonedTime, toZonedTime, format as formatTz } from "date-fns-tz"
import { pt } from "date-fns/locale"

export const TZ = "Europe/Lisbon"

/**
 * Converts a UTC date to the equivalent wall-clock time in Lisbon.
 * Use the result only for display/formatting — its `.getTime()` will lie.
 */
export function utcToLisbon(utcDate: Date): Date {
  return toZonedTime(utcDate, TZ)
}

/**
 * Formats a UTC date in Europe/Lisbon timezone.
 * @param fmt - date-fns format string (e.g. "HH:mm", "dd/MM/yyyy")
 */
export function formatLisbon(date: Date, fmt: string): string {
  const out = formatTz(toZonedTime(date, TZ), fmt, { timeZone: TZ, locale: pt })
  // PT locale lowercases weekday and month ("domingo, 10 de maio"); we capitalize
  // the first letter and the word after " de " for UI consistency.
  return out
    .replace(/^([a-záéíóúâêôãõç])/, (c) => c.toUpperCase())
    .replace(/(\sde\s)([a-záéíóúâêôãõç])/g, (_m, p, c) => p + c.toUpperCase())
}

/**
 * Builds a UTC `Date` from a calendar date + time-of-day in Lisbon local time.
 * Handles DST automatically.
 *
 * @example combineDateTimeLisbon("2026-05-05", "15:00") -> Date for 14:00 UTC (during BST)
 */
export function combineDateTimeLisbon(yyyymmdd: string, hhmm: string): Date {
  const [y, m, d] = yyyymmdd.split("-").map(Number)
  const [hh, mm] = hhmm.split(":").map(Number)
  // Construct an "as if UTC" date with the wall-clock components, then shift by Lisbon offset
  const naive = new Date(Date.UTC(y, m - 1, d, hh, mm))
  return fromZonedTime(naive, TZ)
}

/**
 * Returns the day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD date in Lisbon local time.
 * Avoids DST surprises near midnight by anchoring at noon.
 */
export function getLisbonDayOfWeek(yyyymmdd: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const noonUtc = combineDateTimeLisbon(yyyymmdd, "12:00")
  return utcToLisbon(noonUtc).getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
}

/**
 * Returns the UTC start (00:00 local) and end (next-day 00:00 local) of a Lisbon date.
 * Useful for "all events on day X" queries.
 */
export function getLisbonDayBounds(yyyymmdd: string): { startUtc: Date; endUtc: Date } {
  const [y, m, d] = yyyymmdd.split("-").map(Number)
  const startUtc = combineDateTimeLisbon(yyyymmdd, "00:00")
  const nextDay = new Date(Date.UTC(y, m - 1, d + 1))
  const nextDayStr =
    `${nextDay.getUTCFullYear()}-` +
    `${String(nextDay.getUTCMonth() + 1).padStart(2, "0")}-` +
    `${String(nextDay.getUTCDate()).padStart(2, "0")}`
  const endUtc = combineDateTimeLisbon(nextDayStr, "00:00")
  return { startUtc, endUtc }
}
