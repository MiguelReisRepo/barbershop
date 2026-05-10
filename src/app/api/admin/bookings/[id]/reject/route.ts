import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { formatLisbon } from "@/lib/tz"
import { sendEmail, clientCancelledEmail, getSiteUrl } from "@/lib/email"

/**
 * GET /api/admin/bookings/[id]/reject?token=...
 *
 * Called when the barber clicks "Cancelar" in the email notification.
 * Sets status to CANCELLED, frees up the slot, and notifies the client.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const url = new URL(req.url)
  const token = url.searchParams.get("token")
  const fromAdmin = url.searchParams.get("from") === "admin"
  const site = getSiteUrl()

  const errorUrl = (code: string) =>
    fromAdmin
      ? `${site}/admin?flash=error&code=${code}`
      : `${site}/admin/booking/${id}?error=${code}`

  if (!token) {
    return redirectTo(errorUrl("missing-token"))
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { client: true },
  })

  if (!booking) {
    return redirectTo(errorUrl("not-found"))
  }
  if (booking.adminToken !== token) {
    return redirectTo(errorUrl("invalid-token"))
  }
  if (booking.status === "CANCELLED") {
    return redirectTo(
      fromAdmin
        ? `${site}/admin?flash=already-cancelled`
        : `${site}/admin/booking/${id}?token=${token}&already=1`,
    )
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  })

  if (booking.email) {
    try {
      const tpl = clientCancelledEmail({
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
      console.error("[admin/reject] client email failed:", e)
    }
  }

  return redirectTo(
    fromAdmin
      ? `${site}/admin?flash=cancelled`
      : `${site}/admin/booking/${id}?token=${token}&rejected=1`,
  )
}

function redirectTo(url: string): NextResponse {
  return NextResponse.redirect(url, { status: 302 })
}
