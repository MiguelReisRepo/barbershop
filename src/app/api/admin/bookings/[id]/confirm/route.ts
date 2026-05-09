import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatLisbon } from "@/lib/tz"
import { sendEmail, clientConfirmedEmail, getSiteUrl } from "@/lib/email"

/**
 * GET /api/admin/bookings/[id]/confirm?token=...
 *
 * Called when the barber clicks "Confirmar" in the email notification.
 * Idempotent: confirming an already-confirmed booking is a no-op.
 *
 * Auth: token must match Booking.adminToken (sent only to admin email).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const token = new URL(req.url).searchParams.get("token")
  const site = getSiteUrl()

  if (!token) {
    return redirectTo(`${site}/admin/booking/${id}?error=missing-token`)
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { client: true },
  })

  if (!booking) {
    return redirectTo(`${site}/admin/booking/${id}?error=not-found`)
  }
  if (booking.adminToken !== token) {
    return redirectTo(`${site}/admin/booking/${id}?error=invalid-token`)
  }

  // Idempotent: if already confirmed, just redirect to status page
  if (booking.status === "CONFIRMED") {
    return redirectTo(`${site}/admin/booking/${id}?token=${token}&already=1`)
  }

  if (booking.status === "CANCELLED") {
    return redirectTo(
      `${site}/admin/booking/${id}?token=${token}&error=already-cancelled`,
    )
  }

  // Update booking
  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  })

  // Send confirmation email to client (best effort)
  if (booking.email) {
    try {
      const tpl = clientConfirmedEmail({
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
      await sendEmail({
        to: booking.email,
        subject: tpl.subject,
        html: tpl.html,
      })
    } catch (e) {
      console.error("[admin/confirm] client email failed:", e)
    }
  }

  return redirectTo(`${site}/admin/booking/${id}?token=${token}&confirmed=1`)
}

function redirectTo(url: string): NextResponse {
  return NextResponse.redirect(url, { status: 302 })
}
