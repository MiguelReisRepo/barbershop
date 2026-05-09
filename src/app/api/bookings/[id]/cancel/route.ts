import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatLisbon } from "@/lib/tz"
import {
  sendEmail,
  adminCancelledByClientEmail,
  ADMIN_EMAIL,
  getSiteUrl,
} from "@/lib/email"

/**
 * GET /api/bookings/[id]/cancel?token=<clientToken>
 *
 * Customer-initiated cancellation, reachable from the link in the
 * confirmation/reminder emails. Updates status to CANCELLED, frees the slot,
 * notifies the barber.
 *
 * The user is redirected to /marcacao/[id]?token=... where the new status is shown.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const token = new URL(req.url).searchParams.get("token")
  const site = getSiteUrl()

  if (!token) {
    return NextResponse.redirect(`${site}/?cancel=missing-token`, 302)
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { client: true },
  })

  if (!booking || booking.clientToken !== token) {
    return NextResponse.redirect(`${site}/?cancel=invalid`, 302)
  }

  // Idempotent — already cancelled, just show the page
  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") {
    return NextResponse.redirect(
      `${site}/marcacao/${id}?token=${token}`,
      302,
    )
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  })

  // Notify the barber that the client cancelled
  try {
    const tpl = adminCancelledByClientEmail({
      id: updated.id,
      clientName: booking.client.name,
      clientPhone: booking.client.phone,
      clientEmail: booking.email,
      serviceName: updated.serviceName,
      durationMin: updated.durationMin,
      priceEur: updated.servicePrice,
      location: updated.location === "lisboa" ? "Lisboa" : "Setúbal",
      whenLocal: formatLisbon(
        updated.startUtc,
        "EEEE, dd 'de' MMMM 'às' HH:mm",
      ),
      startUtc: updated.startUtc,
      endUtc: updated.endUtc,
      notes: updated.notes,
      adminToken: updated.adminToken,
      clientToken: updated.clientToken,
    })
    await sendEmail({ to: ADMIN_EMAIL, subject: tpl.subject, html: tpl.html })
  } catch (e) {
    console.error("[client/cancel] admin notification failed:", e)
  }

  return NextResponse.redirect(
    `${site}/marcacao/${id}?token=${token}&cancelled=1`,
    302,
  )
}
