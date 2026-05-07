import { addMinutes, isAfter, isBefore } from "date-fns"
import { combineDateTimeLisbon, getLisbonDayOfWeek } from "./tz"
import {
  type LocationId,
  getWorkingHours,
  FRIDAY_TRAVEL_BLOCK,
} from "./schedule"

const DEFAULT_BUFFER_MIN = 10
const DEFAULT_STEP_MIN = 15

export interface BusyInterval {
  start: Date // UTC
  end: Date // UTC
}

export interface GenerateSlotsOptions {
  /** Date in YYYY-MM-DD format, interpreted as Europe/Lisbon local day */
  isoDate: string
  location: LocationId
  durationMin: number
  busy: BusyInterval[]
  /** Padding around busy intervals (minutes). Default 10. */
  bufferMin?: number
  /** Slot start granularity (minutes). Default 15. */
  stepMin?: number
}

/**
 * Returns available booking slot start times for a day, as UTC `Date`s.
 *
 * Rules:
 *   1. Within working hours from `lib/schedule.ts` for that location + weekday
 *   2. Slot end must not exceed working hours end
 *   3. Slot must not overlap any `busy` interval, padded by `bufferMin` on each side
 *   4. Friday safeguard: Lisboa cannot start before 17:00 local; Setúbal cannot end after 15:00 local
 *      (defense on top of SCHEDULE — never surface a slot that would create a travel collision)
 */
export function generateSlots(opts: GenerateSlotsOptions): Date[] {
  const {
    isoDate,
    location,
    durationMin,
    busy,
    bufferMin = DEFAULT_BUFFER_MIN,
    stepMin = DEFAULT_STEP_MIN,
  } = opts

  const dayOfWeek = getLisbonDayOfWeek(isoDate)
  const hours = getWorkingHours(location, dayOfWeek)
  if (!hours) return []

  let { start, end } = hours

  // Friday cross-city travel safeguard
  if (dayOfWeek === 5) {
    if (location === "lisboa" && start < FRIDAY_TRAVEL_BLOCK.lisboaEarliestStart) {
      start = FRIDAY_TRAVEL_BLOCK.lisboaEarliestStart
    }
    if (location === "setubal" && end > FRIDAY_TRAVEL_BLOCK.setubalLatestEnd) {
      end = FRIDAY_TRAVEL_BLOCK.setubalLatestEnd
    }
  }

  const dayStartUtc = combineDateTimeLisbon(isoDate, start)
  const dayEndUtc = combineDateTimeLisbon(isoDate, end)

  if (!isBefore(dayStartUtc, dayEndUtc)) return []

  const slots: Date[] = []
  let cursor = dayStartUtc

  while (true) {
    const slotEnd = addMinutes(cursor, durationMin)
    if (isAfter(slotEnd, dayEndUtc)) break

    const conflicts = busy.some((b) => {
      const bStart = addMinutes(b.start, -bufferMin)
      const bEnd = addMinutes(b.end, bufferMin)
      // Overlap if cursor < bEnd AND slotEnd > bStart
      return isBefore(cursor, bEnd) && isAfter(slotEnd, bStart)
    })

    if (!conflicts) slots.push(cursor)
    cursor = addMinutes(cursor, stepMin)
  }

  return slots
}

/**
 * Filters out slot start times that are in the past (with a small grace period).
 * Useful for "today" rendering where some slots are already gone.
 */
export function filterFutureSlots(slots: Date[], now: Date = new Date(), graceMin = 5): Date[] {
  const cutoff = addMinutes(now, graceMin)
  return slots.filter((s) => isAfter(s, cutoff))
}
