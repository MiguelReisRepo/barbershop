import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { addMinutes } from "date-fns"
import { prisma } from "@/lib/prisma"
import { buildCombo, validateSelection } from "@/lib/services"
import { createEvent } from "@/lib/gcal"
import { formatLisbon } from "@/lib/tz"

const bodySchema = z.object({
  location: z.enum(["lisboa", "setubal"]),
  /** Array of service item ids, e.g. ["corte", "barba"]. Order doesn't matter. */
  services: z.array(z.string().min(1)).min(1).max(4),
  startUtcIso: z.string().datetime(),
  client: z.object({
    name: z.string().trim().min(2, "Nome demasiado curto").max(80),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9]{9,15}$/, "Telefone deve conter 9-15 dígitos (sem +)"),
  }),
  notes: z.string().max(300).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 },
    )
  }

  const { location, services, startUtcIso, client, notes } = parsed.data

  const v = validateSelection(services)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const combo = buildCombo(services)

  const startUtc = new Date(startUtcIso)
  const endUtc = addMinutes(startUtc, combo.durationMin)

  if (startUtc.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Slot no passado" }, { status: 400 })
  }

  // Race-condition safety: re-check no overlapping booking exists
  const overlapping = await prisma.booking.findFirst({
    where: {
      status: { in: ["PENDING", "CONFIRMED"] },
      startUtc: { lt: endUtc },
      endUtc: { gt: startUtc },
    },
    select: { id: true },
  })
  if (overlapping) {
    return NextResponse.json(
      { error: "Esse horário foi marcado entretanto. Escolhe outro." },
      { status: 409 },
    )
  }

  // Upsert client by phone
  const dbClient = await prisma.client.upsert({
    where: { phone: client.phone },
    update: { name: client.name },
    create: { phone: client.phone, name: client.name },
  })

  // Create booking — serviceId stores the canonical combo key
  const booking = await prisma.booking.create({
    data: {
      clientId: dbClient.id,
      serviceId: combo.key,
      serviceName: combo.name,
      servicePrice: combo.priceEur,
      durationMin: combo.durationMin,
      location,
      startUtc,
      endUtc,
      status: "PENDING",
      notes,
    },
  })

  // Best-effort GCal sync
  try {
    const eventId = await createEvent({
      summary: `[PENDENTE] ${combo.name} - ${client.name}`,
      description:
        `Cliente: ${client.name}\n` +
        `Telefone: ${client.phone}\n` +
        `Serviço: ${combo.name} (${combo.durationMin}min — ${combo.priceEur}€)\n` +
        (notes ? `Notas: ${notes}\n` : "") +
        `\nID: ${booking.id}`,
      location: location === "lisboa" ? "Lisboa" : "Setúbal",
      startUtc,
      endUtc,
    })
    if (eventId) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { gcalEventId: eventId },
      })
    }
  } catch (e) {
    console.error("[bookings] gcal create failed:", e)
  }

  return NextResponse.json({
    ok: true,
    booking: {
      id: booking.id,
      location,
      service: combo.name,
      priceEur: combo.priceEur,
      whenLocal: formatLisbon(startUtc, "EEEE, dd 'de' MMMM 'às' HH:mm"),
      startUtcIso: startUtc.toISOString(),
    },
  })
}
