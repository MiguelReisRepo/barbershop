import { notFound } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, XCircle, Clock, AlertTriangle, MapPin } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatLisbon } from "@/lib/tz"
import { formatPrice } from "@/lib/services"

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Public-facing booking detail page. The customer reaches it via a link
 * sent in their booking emails. Token gate prevents booking-id enumeration.
 */
export default async function MarcacaoPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const sp = await searchParams
  const token = typeof sp.token === "string" ? sp.token : undefined

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { client: true },
  })

  if (!booking) notFound()

  if (!token || booking.clientToken !== token) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20">
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-danger mx-auto mb-3" />
          <h1 className="font-display text-2xl tracking-wider text-danger">
            ACESSO NEGADO
          </h1>
          <p className="mt-3 text-muted">
            O link que recebeste por email pode ter sido truncado. Tenta abrir a
            partir do email original.
          </p>
          <Link href="/" className="mt-6 inline-block btn-gold rounded-md px-6 py-2.5">
            Voltar ao site
          </Link>
        </div>
      </main>
    )
  }

  const isConfirmed = booking.status === "CONFIRMED"
  const isCancelled = booking.status === "CANCELLED"
  const isPending = booking.status === "PENDING"
  const isCompleted = booking.status === "COMPLETED"

  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE

  const whenForCopy = formatLisbon(
    booking.startUtc,
    "EEEE, dd 'de' MMMM 'às' HH:mm",
  )

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="text-center mb-8">
        <div className="gold-divider mx-auto max-w-xs mb-3">
          {isConfirmed ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : isCancelled ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
        </div>
        <h1 className="font-display text-3xl sm:text-4xl tracking-[0.08em] text-gold">
          {isConfirmed
            ? "MARCAÇÃO CONFIRMADA"
            : isCancelled
              ? "MARCAÇÃO CANCELADA"
              : isCompleted
                ? "MARCAÇÃO CONCLUÍDA"
                : "MARCAÇÃO PENDENTE"}
        </h1>
        <p className="text-muted mt-3 text-sm">
          {isConfirmed &&
            `Obrigado pela confiança! Esperamos por ti em ${whenForCopy}.`}
          {isPending &&
            "O barbeiro ainda não confirmou. Vais receber um email assim que o fizer."}
          {isCancelled &&
            "Esta marcação foi cancelada. Se quiseres remarcar, podes fazê-lo abaixo."}
          {isCompleted && "Obrigado pela tua visita."}
        </p>
      </div>

      <div
        className={`rounded-xl border p-6 sm:p-8 ${
          isConfirmed
            ? "border-success/40 bg-success/5"
            : isCancelled
              ? "border-danger/40 bg-danger/5"
              : "border-border bg-background-elevated"
        }`}
      >
        <div className="font-display text-2xl text-gold tracking-wider mb-1">
          {booking.serviceName}
        </div>
        <div className="text-sm text-muted">
          {booking.durationMin} min · {formatPrice(booking.servicePrice)} ·
          pagamento no local
        </div>

        <div className="mt-6 space-y-2 text-sm">
          <Row
            label="Quando"
            value={formatLisbon(booking.startUtc, "EEEE, dd/MM/yyyy 'às' HH:mm")}
            bold
          />
          <Row
            label="Localização"
            value={booking.location === "lisboa" ? "Lisboa" : "Setúbal"}
            icon={<MapPin className="h-3.5 w-3.5" />}
          />
          <div className="border-t border-border my-2"></div>
          <Row label="Cliente" value={booking.client.name} />
          <Row label="Telefone" value={booking.client.phone} />
          {booking.email && <Row label="Email" value={booking.email} />}
        </div>

        {isConfirmed && (
          <div className="mt-6 rounded-md bg-foreground/5 border border-border p-4 text-sm text-foreground/80">
            <strong>Lembra-te:</strong> em caso de atraso superior a 20 minutos, a
            marcação poderá ser cancelada.
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
        {isCancelled || isCompleted ? (
          <Link href="/marcar" className="btn-gold rounded-md px-6 py-2.5 text-center">
            Fazer nova marcação
          </Link>
        ) : (
          <Link
            href="/"
            className="rounded-md border border-border px-6 py-2.5 text-foreground/80 hover:border-gold hover:text-gold transition text-center"
          >
            Voltar ao site
          </Link>
        )}
        {shopPhone && (
          <a
            href={`https://wa.me/${shopPhone}`}
            target="_blank"
            rel="noopener"
            className="rounded-md bg-[#25D366] px-6 py-2.5 font-semibold text-black hover:brightness-110 transition text-center"
          >
            Falar no WhatsApp
          </a>
        )}
      </div>

      <p className="text-xs text-muted text-center mt-8">
        Booking ID: {booking.id}
      </p>
    </main>
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
