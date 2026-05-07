export type LocationId = "lisboa" | "setubal"

export interface Location {
  id: LocationId
  name: string
  address?: string
}

export const LOCATIONS: readonly Location[] = [
  { id: "lisboa", name: "Lisboa" },
  { id: "setubal", name: "Setúbal" },
] as const

export interface WorkingHours {
  start: string // "HH:mm" Lisbon local
  end: string
}

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // 0 = Sunday

/**
 * Weekly schedule per location, in Europe/Lisbon local time.
 * Days not listed = closed.
 */
export const SCHEDULE: Record<LocationId, Partial<Record<DayOfWeek, WorkingHours>>> = {
  setubal: {
    1: { start: "12:00", end: "20:00" }, // Mon
    2: { start: "12:00", end: "20:00" }, // Tue
    3: { start: "15:00", end: "20:00" }, // Wed
    4: { start: "10:00", end: "12:30" }, // Thu
    5: { start: "14:00", end: "15:00" }, // Fri (short — travels to Lisboa after)
  },
  lisboa: {
    // Friday starts 17:00 (NOT 16:30) — travel buffer for Setúbal->Lisboa drive on Friday afternoons.
    // The 15:00-17:00 window is implicitly blocked on Fridays (see slots.ts FRIDAY_TRAVEL_BLOCK).
    5: { start: "17:00", end: "20:00" }, // Fri
    6: { start: "10:00", end: "12:30" }, // Sat
  },
}

/**
 * Defense-in-depth: even if SCHEDULE is edited, slot generator MUST honour these on Fridays.
 */
export const FRIDAY_TRAVEL_BLOCK = {
  setubalLatestEnd: "15:00",
  lisboaEarliestStart: "17:00",
} as const

export function getWorkingHours(
  location: LocationId,
  dayOfWeek: DayOfWeek,
): WorkingHours | null {
  return SCHEDULE[location][dayOfWeek] ?? null
}

export function getLocation(id: string): Location | undefined {
  return LOCATIONS.find((l) => l.id === id)
}
