import { NextRequest, NextResponse } from "next/server"
import { isSessionValid, SESSION_COOKIE_NAME } from "@/lib/admin-session"

/**
 * Admin gate.
 *  - /admin/login          → public (login form)
 *  - /admin/booking/[id]   → public (page itself enforces token OR session)
 *  - /admin/*              → require valid admin session cookie
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === "/admin/login" || pathname.startsWith("/admin/booking/")) {
    return NextResponse.next()
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value
  const ok = await isSessionValid(cookie)
  if (ok) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = "/admin/login"
  url.searchParams.set("next", pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/admin/:path*"],
}
