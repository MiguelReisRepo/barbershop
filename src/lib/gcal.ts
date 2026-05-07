import { google, type calendar_v3 } from "googleapis"
import path from "node:path"
import fs from "node:fs"
import type { BusyInterval } from "./slots"

const SCOPES = ["https://www.googleapis.com/auth/calendar"]
const CREDENTIALS_PATH = path.join(process.cwd(), "google-credentials.json")

let cachedClient: calendar_v3.Calendar | null = null

/**
 * Load service-account credentials from one of:
 *   1. GOOGLE_CREDENTIALS_JSON env var (raw JSON string) — used on Vercel/serverless
 *   2. google-credentials.json file at project root — used in local dev
 * Returns null if neither is available.
 */
function loadAuthOpts(): { keyFile: string } | { credentials: object } | null {
  const envJson = process.env.GOOGLE_CREDENTIALS_JSON
  if (envJson) {
    try {
      return { credentials: JSON.parse(envJson) }
    } catch (e) {
      console.error("[gcal] GOOGLE_CREDENTIALS_JSON is not valid JSON:", e)
      return null
    }
  }
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return { keyFile: CREDENTIALS_PATH }
  }
  return null
}

function hasCredentials(): boolean {
  return loadAuthOpts() !== null && Boolean(process.env.GCAL_CALENDAR_ID)
}

function getClient(): calendar_v3.Calendar {
  if (cachedClient) return cachedClient

  const authOpts = loadAuthOpts()
  if (!authOpts) {
    throw new Error(
      "Google credentials not configured. Set GOOGLE_CREDENTIALS_JSON env var " +
        `(serverless) or place ${CREDENTIALS_PATH} (local dev).`,
    )
  }
  if (!process.env.GCAL_CALENDAR_ID) {
    throw new Error("GCAL_CALENDAR_ID env var not set.")
  }

  const auth = new google.auth.GoogleAuth({
    ...authOpts,
    scopes: SCOPES,
  })

  cachedClient = google.calendar({ version: "v3", auth })
  return cachedClient
}

/**
 * Fetches busy intervals from Google Calendar.
 * Falls back to empty array (with a warning) if credentials/calendar not configured —
 * lets local dev work before GCal is set up.
 */
export async function getBusyIntervals(
  timeMinUtc: Date,
  timeMaxUtc: Date,
): Promise<BusyInterval[]> {
  if (!hasCredentials()) {
    console.warn("[gcal] No credentials/calendar — returning empty busy list (dev mode)")
    return []
  }

  const cal = getClient()
  const res = await cal.events.list({
    calendarId: process.env.GCAL_CALENDAR_ID!,
    timeMin: timeMinUtc.toISOString(),
    timeMax: timeMaxUtc.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  })

  return (res.data.items ?? [])
    .filter((e) => e.start?.dateTime && e.end?.dateTime) // skip all-day events
    .map((e) => ({
      start: new Date(e.start!.dateTime!),
      end: new Date(e.end!.dateTime!),
    }))
}

export interface CreateEventInput {
  summary: string
  description: string
  location?: string
  startUtc: Date
  endUtc: Date
}

/**
 * Creates an event in Google Calendar.
 * Returns the event id, or null if GCal isn't configured (booking still proceeds in DB).
 */
export async function createEvent(input: CreateEventInput): Promise<string | null> {
  if (!hasCredentials()) {
    console.warn("[gcal] No credentials/calendar — skipping event creation (dev mode)")
    return null
  }

  const cal = getClient()
  const res = await cal.events.insert({
    calendarId: process.env.GCAL_CALENDAR_ID!,
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.startUtc.toISOString(), timeZone: "Europe/Lisbon" },
      end: { dateTime: input.endUtc.toISOString(), timeZone: "Europe/Lisbon" },
    },
  })

  return res.data.id ?? null
}

export async function deleteEvent(eventId: string): Promise<void> {
  if (!hasCredentials()) return
  const cal = getClient()
  await cal.events.delete({
    calendarId: process.env.GCAL_CALENDAR_ID!,
    eventId,
  })
}
