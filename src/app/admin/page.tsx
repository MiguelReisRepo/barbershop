import Link from "next/link"
import {
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  LogOut,
  MapPin,
  AlertCircle,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatLisbon } from "@/lib/tz"
import { formatPrice } from "@/lib/services"
import type { Prisma } from "@/generated/prisma"

export const dynamic = "force-dynamic"

const STATUSES = ["ALL", "PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"] as const
type StatusFilter = (typeof STATUSES)[number]

const RANGES = ["upcoming", "today", "week", "all"] as const
type RangeFilter = (typeof RANGES)[number]

interface PageProps {
  searchParams: Promise<{
    status?: string
    range?: string
    location?: string
  }>
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const status = (sp.status as StatusFilter) ?? "PENDING"
  const range = (sp.range as RangeFilter) ?? "upcoming"
  const location = sp.location

  const where: Prisma.BookingWhereInput = {}
  if (status !== "ALL") where.status = status
  if (location === "lisboa" || location === "setubal") where.location = location

  const now = new Date()
  if (range === "upcoming") {
    where.startUtc = { gte: now }
  } else if (range === "today") {
    const start = new Date(now)
    start.setUTCHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setUTCDate(end.getUTCDate() + 1)
    where.startUtc = { gte: start, lt: end }
  } else if (range === "week") {
    const end = new Date(now)
    end.setUTCDate(end.getUTCDate() + 7)
    where.startUtc = { gte: now, lt: end }
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: { client: true },
    orderBy: { startUtc: "asc" },
    take: 200,
  })

  const counts = await prisma.booking.groupBy({
    by: ["status"],
    _count: true,
  })
  const countByStatus = Object.fromEntries(
    counts.map((c) => [c.status, c._count]),
  )

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-3xl tracking-[0.06em] text-gold">
          ADMIN
        </h1>
        <a
          href="/api/admin/auth/logout"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold transition"
        >
          <LogOut className="h-4 w-4" /> Sair
        </a>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-background-elevated p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <FilterGroup label="Estado">
            {STATUSES.map((s) => (
              <FilterChip
                key={s}
                href={searchUrl({ status: s, range, location })}
                active={status === s}
                badge={s !== "ALL" ? countByStatus[s] : undefined}
              >
                {labelStatus(s)}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="Período">
            {RANGES.map((r) => (
              <FilterChip
                key={r}
                href={searchUrl({ status, range: r, location })}
                active={range === r}
              >
                {labelRange(r)}
              </FilterChip>
            ))}
          </FilterGroup>

          <FilterGroup label="Localização">
            <FilterChip
              href={searchUrl({ status, range })}
              active={!location}
            >
              Todas
            </FilterChip>
            <FilterChip
              href={searchUrl({ status, range, location: "lisboa" })}
              active={location === "lisboa"}
            >
              Lisboa
            </FilterChip>
            <FilterChip
              href={searchUrl({ status, range, location: "setubal" })}
              active={location === "setubal"}
            >
              Setúbal
            </FilterChip>
          </FilterGroup>
        </div>
      </div>

      {/* Bookings list */}
      {bookings.length === 0 ? (
        <div className="rounded-lg border border-border bg-background-elevated p-10 text-center">
          <AlertCircle className="h-8 w-8 text-muted mx-auto mb-3" />
          <p className="text-muted">Nenhuma marcação corresponde aos filtros.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={`/admin/booking/${b.id}?token=${b.adminToken}`}
              className="card-lift block rounded-lg border border-border bg-background-elevated p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusPill status={b.status} />
                    <span className="font-display text-lg tracking-wider text-gold">
                      {b.serviceName}
                    </span>
                    <span className="text-muted text-sm">·</span>
                    <span className="inline-flex items-center gap-1 text-sm text-muted">
                      <MapPin className="h-3.5 w-3.5" />
                      {b.location === "lisboa" ? "Lisboa" : "Setúbal"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="text-foreground">
                      {formatLisbon(
                        b.startUtc,
                        "EEE, dd/MM/yyyy 'às' HH:mm",
                      )}
                    </span>
                    <span className="text-muted">
                      {" "}· {b.durationMin} min · {formatPrice(b.servicePrice)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    {b.client.name} · +{b.client.phone}
                    {b.email && <> · {b.email}</>}
                  </div>
                </div>
                <div className="text-xs text-muted whitespace-nowrap">
                  {b.client.loyaltyCount > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Award className="h-3 w-3 text-gold" />
                      {b.client.loyaltyCount} cortes
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

function searchUrl(params: {
  status?: StatusFilter
  range?: RangeFilter
  location?: string
}): string {
  const sp = new URLSearchParams()
  if (params.status && params.status !== "PENDING") sp.set("status", params.status)
  if (params.range && params.range !== "upcoming") sp.set("range", params.range)
  if (params.location) sp.set("location", params.location)
  const q = sp.toString()
  return `/admin${q ? `?${q}` : ""}`
}

function labelStatus(s: StatusFilter): string {
  switch (s) {
    case "ALL":
      return "Todas"
    case "PENDING":
      return "Pendentes"
    case "CONFIRMED":
      return "Confirmadas"
    case "CANCELLED":
      return "Canceladas"
    case "COMPLETED":
      return "Concluídas"
  }
}

function labelRange(r: RangeFilter): string {
  switch (r) {
    case "upcoming":
      return "Próximas"
    case "today":
      return "Hoje"
    case "week":
      return "7 dias"
    case "all":
      return "Tudo"
  }
}

function FilterGroup({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.15em] text-muted mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function FilterChip({
  href,
  active,
  badge,
  children,
}: {
  href: string
  active: boolean
  badge?: number | string
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-full bg-gold text-black px-3 py-1 text-xs font-semibold inline-flex items-center gap-1.5"
          : "rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground/80 hover:border-gold hover:text-gold transition inline-flex items-center gap-1.5"
      }
    >
      {children}
      {badge !== undefined && badge !== 0 && (
        <span
          className={
            active
              ? "rounded-full bg-black/15 px-1.5 py-0.5 text-[10px]"
              : "rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px]"
          }
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<
    string,
    { color: string; bg: string; icon: React.ReactNode; label: string }
  > = {
    PENDING: {
      color: "text-gold",
      bg: "bg-gold/10 border-gold/30",
      icon: <Clock className="h-3 w-3" />,
      label: "Pendente",
    },
    CONFIRMED: {
      color: "text-success",
      bg: "bg-success/10 border-success/30",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Confirmada",
    },
    CANCELLED: {
      color: "text-danger",
      bg: "bg-danger/10 border-danger/30",
      icon: <XCircle className="h-3 w-3" />,
      label: "Cancelada",
    },
    COMPLETED: {
      color: "text-muted",
      bg: "bg-foreground/5 border-border",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Concluída",
    },
  }
  const cfg = map[status] ?? map.PENDING
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${cfg.color} ${cfg.bg}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}
