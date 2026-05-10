import Link from "next/link"
import {
  Calendar,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Award,
  LogOut,
  ArrowLeft,
} from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatPrice } from "@/lib/services"
import { formatLisbon } from "@/lib/tz"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const now = new Date()

  // Period boundaries (UTC anchors) — good enough for stats; for strict
  // Lisbon-local boundaries we'd use getLisbonDayBounds, but month/year
  // boundaries are not DST-sensitive.
  const startOfDay = new Date(now)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const startOfWeek = new Date(now)
  startOfWeek.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7)) // Monday
  startOfWeek.setUTCHours(0, 0, 0, 0)
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))

  const earningStatuses = { in: ["CONFIRMED", "COMPLETED"] }

  const [
    todayRev,
    weekRev,
    monthRev,
    yearRev,
    allTimeRev,
    statusCounts,
    locationCounts,
    serviceCounts,
    totalClients,
    topClients,
    upcoming,
    cancelledThisMonth,
  ] = await Promise.all([
    prisma.booking.aggregate({
      where: { status: earningStatuses, startUtc: { gte: startOfDay } },
      _sum: { servicePrice: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { status: earningStatuses, startUtc: { gte: startOfWeek } },
      _sum: { servicePrice: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { status: earningStatuses, startUtc: { gte: startOfMonth } },
      _sum: { servicePrice: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { status: earningStatuses, startUtc: { gte: startOfYear } },
      _sum: { servicePrice: true },
      _count: true,
    }),
    prisma.booking.aggregate({
      where: { status: earningStatuses },
      _sum: { servicePrice: true },
      _count: true,
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: true,
      _sum: { servicePrice: true },
    }),
    prisma.booking.groupBy({
      by: ["location"],
      where: { status: earningStatuses },
      _count: true,
      _sum: { servicePrice: true },
    }),
    prisma.booking.groupBy({
      by: ["serviceName"],
      where: { status: earningStatuses },
      _count: true,
      _sum: { servicePrice: true },
      orderBy: { _count: { serviceName: "desc" } },
      take: 6,
    }),
    prisma.client.count(),
    prisma.client.findMany({
      orderBy: { loyaltyCount: "desc" },
      take: 5,
      where: { loyaltyCount: { gt: 0 } },
    }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED", startUtc: { gte: now } },
      include: { client: true },
      orderBy: { startUtc: "asc" },
      take: 5,
    }),
    prisma.booking.count({
      where: { status: "CANCELLED", startUtc: { gte: startOfMonth } },
    }),
  ])

  const countByStatus = Object.fromEntries(
    statusCounts.map((c) => [c.status, c._count]),
  )

  const totalThisMonth = monthRev._count + cancelledThisMonth
  const cancelRate =
    totalThisMonth > 0
      ? Math.round((cancelledThisMonth / totalThisMonth) * 100)
      : 0

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-gold transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Marcações
          </Link>
          <span className="text-muted">/</span>
          <h1 className="font-display text-3xl tracking-[0.06em] text-gold">
            DASHBOARD
          </h1>
        </div>
        <a
          href="/api/admin/auth/logout"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gold transition"
        >
          <LogOut className="h-4 w-4" /> Sair
        </a>
      </div>

      {/* Revenue by period */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted mb-3">
          Faturação
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <RevenueCard
            label="Hoje"
            count={todayRev._count}
            amount={todayRev._sum.servicePrice ?? 0}
          />
          <RevenueCard
            label="Esta semana"
            count={weekRev._count}
            amount={weekRev._sum.servicePrice ?? 0}
          />
          <RevenueCard
            label="Este mês"
            count={monthRev._count}
            amount={monthRev._sum.servicePrice ?? 0}
            highlight
          />
          <RevenueCard
            label="Este ano"
            count={yearRev._count}
            amount={yearRev._sum.servicePrice ?? 0}
          />
          <RevenueCard
            label="Total"
            count={allTimeRev._count}
            amount={allTimeRev._sum.servicePrice ?? 0}
          />
        </div>
        <p className="text-xs text-muted mt-2">
          Inclui marcações <strong className="text-foreground">Confirmadas</strong> e{" "}
          <strong className="text-foreground">Concluídas</strong>. Pendentes não
          contam.
        </p>
      </section>

      {/* Status breakdown */}
      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted mb-3">
          Estado das marcações
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatusCard
            icon={<Clock className="h-4 w-4" />}
            label="Pendentes"
            count={countByStatus["PENDING"] ?? 0}
            tone="gold"
          />
          <StatusCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Confirmadas"
            count={countByStatus["CONFIRMED"] ?? 0}
            tone="success"
          />
          <StatusCard
            icon={<Award className="h-4 w-4" />}
            label="Concluídas"
            count={countByStatus["COMPLETED"] ?? 0}
            tone="success"
          />
          <StatusCard
            icon={<XCircle className="h-4 w-4" />}
            label="Canceladas"
            count={countByStatus["CANCELLED"] ?? 0}
            tone="danger"
          />
        </div>
        <p className="text-xs text-muted mt-2">
          Taxa de cancelamento (mês corrente):{" "}
          <strong className="text-foreground">{cancelRate}%</strong>
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Por localização */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted mb-3">
            Por localização
          </h2>
          <div className="rounded-lg border border-border bg-background-elevated p-4 space-y-3">
            {locationCounts.length === 0 ? (
              <p className="text-sm text-muted">Sem dados.</p>
            ) : (
              locationCounts.map((row) => (
                <div key={row.location} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-foreground">
                    <MapPin className="h-4 w-4 text-gold" />
                    {row.location === "lisboa" ? "Lisboa" : "Setúbal"}
                  </span>
                  <span className="text-sm">
                    <span className="text-foreground">{row._count}</span>
                    <span className="text-muted">
                      {" "}· {formatPrice(row._sum.servicePrice ?? 0)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Por serviço */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted mb-3">
            Top serviços
          </h2>
          <div className="rounded-lg border border-border bg-background-elevated p-4 space-y-3">
            {serviceCounts.length === 0 ? (
              <p className="text-sm text-muted">Sem dados.</p>
            ) : (
              serviceCounts.map((row) => (
                <div key={row.serviceName} className="flex items-center justify-between">
                  <span className="text-foreground">{row.serviceName}</span>
                  <span className="text-sm">
                    <span className="text-foreground">{row._count}</span>
                    <span className="text-muted">
                      {" "}· {formatPrice(row._sum.servicePrice ?? 0)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Top clientes */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted mb-3">
            Clientes fiéis
          </h2>
          <div className="rounded-lg border border-border bg-background-elevated p-4 space-y-3">
            <div className="flex items-center justify-between text-sm pb-2 border-b border-border">
              <span className="inline-flex items-center gap-2 text-muted">
                <Users className="h-4 w-4" />
                Clientes registados
              </span>
              <strong className="text-foreground">{totalClients}</strong>
            </div>
            {topClients.length === 0 ? (
              <p className="text-sm text-muted">Sem clientes com cortes ainda.</p>
            ) : (
              topClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{c.name}</span>
                  <span className="inline-flex items-center gap-1 text-gold">
                    <Award className="h-3 w-3" />
                    {c.loyaltyCount}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Próximas marcações */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-muted mb-3">
            Próximas marcações confirmadas
          </h2>
          <div className="rounded-lg border border-border bg-background-elevated p-4 space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted">Não há marcações futuras confirmadas.</p>
            ) : (
              upcoming.map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/booking/${b.id}?token=${b.adminToken}`}
                  className="block hover:opacity-90 transition"
                >
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <div className="text-foreground">{b.client.name}</div>
                      <div className="text-muted text-xs">
                        {b.serviceName} ·{" "}
                        {b.location === "lisboa" ? "Lisboa" : "Setúbal"}
                      </div>
                    </div>
                    <div className="text-xs text-muted whitespace-nowrap">
                      {formatLisbon(b.startUtc, "EEE dd/MM HH:mm")}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function RevenueCard({
  label,
  count,
  amount,
  highlight,
}: {
  label: string
  count: number
  amount: number
  highlight?: boolean
}) {
  return (
    <div
      className={
        "rounded-lg border p-4 " +
        (highlight
          ? "border-gold/40 bg-gold/5"
          : "border-border bg-background-elevated")
      }
    >
      <div className="text-xs uppercase tracking-[0.12em] text-muted">{label}</div>
      <div
        className={
          "mt-1 font-display text-2xl tracking-wider " +
          (highlight ? "text-gold" : "text-foreground")
        }
      >
        {formatPrice(amount)}
      </div>
      <div className="text-xs text-muted mt-0.5 inline-flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {count} marcações
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  label,
  count,
  tone,
}: {
  icon: React.ReactNode
  label: string
  count: number
  tone: "gold" | "success" | "danger"
}) {
  const cls =
    tone === "gold"
      ? "border-gold/30 bg-gold/5 text-gold"
      : tone === "success"
        ? "border-success/30 bg-success/5 text-success"
        : "border-danger/30 bg-danger/5 text-danger"
  return (
    <div className={`rounded-lg border p-4 ${cls}`}>
      <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] opacity-80">
        {icon}
        {label}
      </div>
      <div className="font-display text-3xl tracking-wider mt-2">{count}</div>
    </div>
  )
}
