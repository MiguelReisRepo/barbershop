import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isSessionValid, SESSION_COOKIE_NAME } from "@/lib/admin-session"

/**
 * DELETE /api/admin/bookings/cancelled
 *
 * Bulk-deletes all bookings with status = "CANCELLED". Used by the admin to
 * clear out cancellation history. Auth: requires a valid admin session
 * cookie (per-booking adminToken does not apply to a bulk action).
 */
export async function DELETE(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!(await isSessionValid(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await prisma.booking.deleteMany({
    where: { status: "CANCELLED" },
  })
  return NextResponse.json({ ok: true, deleted: result.count })
}
