import { NextRequest, NextResponse } from "next/server"
import {
  makeSessionValue,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "@/lib/admin-session"

/**
 * POST /api/admin/auth/login (form-encoded)
 * Body: password=<...>&next=<url>
 *
 * If the password matches `ADMIN_PASSWORD` env var, sets the session cookie
 * and redirects to `next`. Otherwise redirects back to /admin/login?error=wrong.
 */
export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD
  const data = await req.formData()
  const password = data.get("password")?.toString() ?? ""
  const next = data.get("next")?.toString() || "/admin"

  if (!adminPassword) {
    const url = new URL("/admin/login", req.url)
    url.searchParams.set("error", "config")
    return NextResponse.redirect(url, 302)
  }
  if (password !== adminPassword) {
    const url = new URL("/admin/login", req.url)
    url.searchParams.set("error", "wrong")
    if (next) url.searchParams.set("next", next)
    return NextResponse.redirect(url, 302)
  }

  // Defensively keep the redirect destination on this site
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/admin"

  const res = NextResponse.redirect(new URL(safeNext, req.url), 302)
  res.cookies.set(SESSION_COOKIE_NAME, await makeSessionValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
  return res
}
