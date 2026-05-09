import { NextRequest, NextResponse } from "next/server"
import { addHours } from "date-fns"
import { prisma } from "@/lib/prisma"
import { formatLisbon } from "@/lib/tz"
import { sendEmail, clientReminderEmail } from "@/lib/email"

/**
 * Cron job — runs daily (see vercel.json). Finds CONFIRMED bookings that
 * start ~24 hours from now (a 22h–30h window catches everything between
 * runs even with timezone/DST shifts) and sends a reminder email if one
 * hasn't been sent already.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We check
 * this to prevent random callers from triggering reminder spam.
 */
export async function GET(req: NextRequest) {
  // --- Auth gate ---
  const expected = process.env.CRON_SECRET
  if (expected) {
    const got = req.headers.get("authorization") ?? ""
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }
  // If CRON_SECRET isn't set, allow the request through (useful in local dev / first deploy).
  // Set CRON_SECRET in production.

  const now = new Date()
  const startMin = addHours(now, 22)
  const startMax = addHours(now, 30)

  const bookings = await prisma.booking.findMany({
    where: {
      status: "CONFIRMED",
      reminderSentAt: null,
      startUtc: { gte: startMin, lte: startMax },
    },
    include: { client: true },
  })

  const results: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const booking of bookings) {
    if (!booking.email) {
      // No email on file — skip but mark as "sent" so we don't keep retrying
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      })
      results.push({ id: booking.id, ok: false, error: "no email" })
      continue
    }
    const tpl = clientReminderEmail({
      id: booking.id,
      clientName: booking.client.name,
      clientPhone: booking.client.phone,
      clientEmail: booking.email,
      serviceName: booking.serviceName,
      durationMin: booking.durationMin,
      priceEur: booking.servicePrice,
      location: booking.location === "lisboa" ? "Lisboa" : "Setúbal",
      whenLocal: formatLisbon(
        booking.startUtc,
        "EEEE, dd 'de' MMMM 'às' HH:mm",
      ),
      startUtc: booking.startUtc,
      endUtc: booking.endUtc,
      notes: booking.notes,
      adminToken: booking.adminToken,
      clientToken: booking.clientToken,
    })
    const r = await sendEmail({
      to: booking.email,
      subject: tpl.subject,
      html: tpl.html,
    })
    if (r.ok) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { reminderSentAt: new Date() },
      })
    }
    results.push({ id: booking.id, ok: r.ok, error: r.error })
  }

  return NextResponse.json({
    ok: true,
    runAt: now.toISOString(),
    found: bookings.length,
    results,
  })
}
