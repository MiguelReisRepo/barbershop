import { notFound } from "next/navigation"
import Link from "next/link"
import { cookies } from "next/headers"
import { CheckCircle2, XCircle, AlertTriangle, Clock, MapPin } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatLisbon } from "@/lib/tz"
import { formatPrice } from "@/lib/services"
import { isSessionValid, SESSION_COOKIE_NAME } from "@/lib/admin-session"

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminBookingPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const token = typeof sp.token === "string" ? sp.token : undefined
  const error = typeof sp.error === "string" ? sp.error : undefined
  const confirmed = sp.confirmed === "1"
  const rejected = sp.rejected === "1"
  const already = sp.already === "1"

  // Auth: either a valid admin session cookie OR a matching adminToken in URL
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const hasSession = await isSessionValid(sessionCookie)

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20">
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-danger mx-auto mb-3" />
          <h1 className="font-display text-2xl tracking-wider text-danger">
            ERRO
          </h1>
          <p className="mt-3 text-muted">
            {errorMessage(error)}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block btn-gold rounded-md px-6 py-2.5"
          >
            Voltar ao site
          </Link>
        </div>
      </main>
    )
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { client: true },
  })

  if (!booking) notFound()
  const tokenMatches = token && booking.adminToken === token
  if (!hasSession && !tokenMatches) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20">
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-danger mx-auto mb-3" />
          <h1 className="font-display text-2xl tracking-wider text-danger">
            ACESSO NEGADO
          </h1>
          <p className="mt-3 text-muted">
            Token inválido ou sessão expirada. Faz login.
          </p>
          <Link
            href={`/admin/login?next=${encodeURIComponent(`/admin/booking/${id}`)}`}
            className="mt-6 inline-block btn-gold rounded-md px-6 py-2.5"
          >
            Login
          </Link>
        </div>
      </main>
    )
  }

  const isConfirmed = booking.status === "CONFIRMED"
  const isCancelled = booking.status === "CANCELLED"
  const isPending = booking.status === "PENDING"

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div
        className={`rounded-xl border p-6 sm:p-8 ${
          isConfirmed
            ? "border-success/40 bg-success/5"
            : isCancelled
              ? "border-danger/40 bg-danger/5"
              : "border-border bg-background-elevated"
        }`}
      >
        {/* Status banner */}
        {confirmed && (
          <Banner
            icon={<CheckCircle2 className="h-7 w-7" />}
            tone="success"
            title="MARCAÇÃO CONFIRMADA"
            body={
              booking.email
                ? `Email de confirmação enviado para ${booking.email}.`
                : "Cliente notificado."
            }
          />
        )}
        {rejected && (
          <Banner
            icon={<XCircle className="h-7 w-7" />}
            tone="danger"
            title="MARCAÇÃO CANCELADA"
            body={
              booking.email
                ? `Email de cancelamento enviado para ${booking.email}.`
                : "Cliente notificado."
            }
          />
        )}
        {already && !confirmed && !rejected && (
          <Banner
            icon={<AlertTriangle className="h-6 w-6" />}
            tone="muted"
            title={
              isConfirmed
                ? "JÁ TINHA SIDO CONFIRMADA"
                : isCancelled
                  ? "JÁ TINHA SIDO CANCELADA"
                  : "ESTADO ATUAL"
            }
            body={`Status: ${booking.status}`}
          />
        )}
        {!confirmed && !rejected && !already && isPending && (
          <Banner
            icon={<Clock className="h-6 w-6" />}
            tone="muted"
            title="MARCAÇÃO PENDENTE"
            body="Confirma ou cancela usando os botões abaixo."
          />
        )}

        {/* Inline action buttons — only when still pending */}
        {isPending && !confirmed && !rejected && (
          <div className="my-5 flex flex-col sm:flex-row gap-2">
            <a
              href={`/api/admin/bookings/${booking.id}/confirm?token=${booking.adminToken}&from=admin`}
              className="rounded-md bg-success px-6 py-2.5 font-semibold text-black hover:brightness-110 transition text-center"
            >
              ✓ Confirmar
            </a>
            <a
              href={`/api/admin/bookings/${booking.id}/reject?token=${booking.adminToken}&from=admin`}
              className="rounded-md bg-danger px-6 py-2.5 font-semibold text-white hover:brightness-110 transition text-center"
            >
              ✗ Cancelar
            </a>
          </div>
        )}

        <h1 className="font-display text-2xl sm:text-3xl tracking-[0.06em] text-gold mt-2">
          {booking.serviceName}
        </h1>

        <dl className="mt-5 space-y-2 text-sm">
          <Row label="Quando" value={formatLisbon(booking.startUtc, "EEEE, dd/MM/yyyy 'às' HH:mm")} />
          <Row
            label="Localização"
            value={booking.location === "lisboa" ? "Lisboa" : "Setúbal"}
            icon={<MapPin className="h-3.5 w-3.5" />}
          />
          <Row label="Duração" value={`${booking.durationMin} minutos`} />
          <Row label="Preço" value={formatPrice(booking.servicePrice)} />
          <div className="border-t border-border my-2"></div>
          <Row label="Cliente" value={booking.client.name} bold />
          <Row label="Telefone" value={booking.client.phone} />
          {booking.email && <Row label="Email" value={booking.email} />}
          {booking.notes && <Row label="Notas" value={booking.notes} />}
        </dl>

        <p className="text-xs text-muted mt-6 text-center">
          Booking ID: {booking.id}
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-gold underline text-sm hover:text-gold-bright">
          Voltar ao site
        </Link>
      </div>
    </main>
  )
}

function errorMessage(code: string): string {
  switch (code) {
    case "missing-token":
      return "Falta o token de autenticação."
    case "invalid-token":
      return "Token inválido ou expirado."
    case "not-found":
      return "Marcação não encontrada."
    case "already-cancelled":
      return "Esta marcação já foi cancelada e não pode ser confirmada."
    default:
      return "Ocorreu um erro inesperado."
  }
}

function Banner({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode
  title: string
  body: string
  tone: "success" | "danger" | "muted"
}) {
  const color =
    tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-gold"
  return (
    <div className={`flex items-start gap-3 mb-4 ${color}`}>
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className="font-display tracking-[0.1em] text-base">{title}</div>
        <div className="text-sm text-foreground/75 mt-0.5">{body}</div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  icon,
}: {
  label: string
  value: string
  bold?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={`text-foreground inline-flex items-center gap-1.5 ${bold ? "font-semibold" : ""}`}>
        {icon}
        {value}
      </span>
    </div>
  )
}
