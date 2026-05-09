import { redirect } from "next/navigation"
import { Lock } from "lucide-react"

interface PageProps {
  searchParams: Promise<{ error?: string; next?: string }>
}

/**
 * Admin login form. Uses a server action POST -> /api/admin/auth/login.
 * Already-logged-in users are not redirected (re-typing the password is fine).
 */
export default async function AdminLoginPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const next = sp.next ?? "/admin"
  const error = sp.error

  // Honour login-success redirects (server action sets ?ok=1 then we go on)
  // (the actual auth happens in /api/admin/auth/login)

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <div className="text-center mb-8">
        <Lock className="h-10 w-10 text-gold mx-auto mb-3" />
        <h1 className="font-display text-3xl tracking-[0.08em] text-gold">
          ADMIN
        </h1>
        <p className="mt-3 text-muted text-sm">
          Acesso reservado ao barbeiro.
        </p>
      </div>

      <form
        action="/api/admin/auth/login"
        method="POST"
        className="rounded-xl border border-border bg-background-elevated p-6 sm:p-8 space-y-4"
      >
        <input type="hidden" name="next" value={next} />
        <label className="block">
          <span className="block text-sm text-muted mb-1.5">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            className="w-full rounded-md border border-border bg-background px-4 py-2 focus:border-gold focus:outline-none"
          />
        </label>
        {error === "wrong" && (
          <div className="text-danger text-sm">Password incorreta.</div>
        )}
        {error === "config" && (
          <div className="text-danger text-sm">
            Admin password não configurada no servidor (env var ADMIN_PASSWORD).
          </div>
        )}
        <button type="submit" className="btn-gold rounded-md w-full py-2.5">
          Entrar
        </button>
      </form>
    </main>
  )
}

export function generateMetadata() {
  return { title: "Admin · Tarzan's Barbershop", robots: "noindex" }
}

// Avoid static export of this page so the form can post fresh every time.
export const dynamic = "force-dynamic"

// Helper for downstream pages — not used here directly but exported as a hint
export async function _redirectIfLoggedIn(_: unknown) {
  redirect("/admin")
}
