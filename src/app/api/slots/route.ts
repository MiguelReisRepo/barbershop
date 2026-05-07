import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { getLisbonDayBounds } from "@/lib/tz"
import { generateSlots, filterFutureSlots } from "@/lib/slots"
import { buildCombo, parseServicesParam, validateSelection } from "@/lib/services"
import type { LocationId } from "@/lib/schedule"
import { getBusyIntervals } from "@/lib/gcal"

const querySchema = z.object({
  location: z.enum(["lisboa", "setubal"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  // Comma-separated services, e.g. "corte,barba"
  services: z.string().min(1),
})

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(new URL(req.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.format() },
      { status: 400 },
    )
  }

  const { location, date, services: servicesCsv } = parsed.data
  const itemIds = parseServicesParam(servicesCsv)
  const v = validateSelection(itemIds)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const combo = buildCombo(itemIds)

  const { startUtc: dayStart, endUtc: dayEnd } = getLisbonDayBounds(date)

  const [gcalBusy, dbBookings] = await Promise.all([
    getBusyIntervals(dayStart, dayEnd).catch((e) => {
      console.error("[slots] gcal failed:", e)
      return []
    }),
    prisma.booking.findMany({
      where: {
        status: { in: ["PENDING", "CONFIRMED"] },
        startUtc: { lt: dayEnd },
        endUtc: { gt: dayStart },
      },
      select: { startUtc: true, endUtc: true },
    }),
  ])

  const allBusy = [
    ...gcalBusy,
    ...dbBookings.map((b) => ({ start: b.startUtc, end: b.endUtc })),
  ]

  const slots = filterFutureSlots(
    generateSlots({
      isoDate: date,
      location: location as LocationId,
      durationMin: combo.durationMin,
      busy: allBusy,
    }),
  )

  return NextResponse.json({
    slots: slots.map((s) => s.toISOString()),
    combo: {
      name: combo.name,
      priceEur: combo.priceEur,
      durationMin: combo.durationMin,
    },
  })
}
