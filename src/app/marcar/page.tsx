"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Calendar as CalendarIcon,
  Sparkles,
  Scissors,
  Star,
  Award,
  Check,
  AlertCircle,
} from "lucide-react"
import {
  LOCATIONS,
  getNextOpenDate,
  isLocationOpenOn,
  type LocationId,
} from "@/lib/schedule"
import {
  SERVICES,
  buildCombo,
  validateSelection,
  formatPrice,
  marginalPrice,
  parseServicesParam,
  type ServiceId,
  type Combo,
} from "@/lib/services"
import { formatLisbon, getLisbonDayOfWeek } from "@/lib/tz"
import { cn } from "@/lib/utils"

type Step =
  | "services"
  | "location"
  | "date"
  | "slot"
  | "details"
  | "confirm"
  | "success"

interface BookingState {
  services?: ServiceId[]
  location?: LocationId
  date?: string
  slotIso?: string
  name?: string
  phone?: string
  email?: string
  notes?: string
}

interface SuccessPayload {
  bookingId: string
  clientToken: string
  whenLocal: string
  serviceName: string
  priceEur: number
  location: LocationId
}

const todayLocal = () => format(new Date(), "yyyy-MM-dd")
const maxDateLocal = () => {
  const d = new Date()
  d.setDate(d.getDate() + 60)
  return format(d, "yyyy-MM-dd")
}

const STEPS: Step[] = ["services", "location", "date", "slot", "details", "confirm"]

export default function MarcarPage() {
  return (
    <Suspense fallback={<MarcarFallback />}>
      <MarcarFlow />
    </Suspense>
  )
}

function MarcarFallback() {
  return (
    <main className="border-b border-border">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-muted">
        A carregar…
      </div>
    </main>
  )
}

function MarcarFlow() {
  const params = useSearchParams()
  const initialServices = parseServicesParam(params.get("services")) as ServiceId[]
  const validInitial = validateSelection(initialServices)

  // Skip "services" step if URL pre-fills a valid selection
  const [step, setStep] = useState<Step>(
    validInitial.ok && initialServices.length > 0 ? "location" : "services",
  )
  const [state, setState] = useState<BookingState>(
    validInitial.ok ? { services: initialServices } : {},
  )
  const [success, setSuccess] = useState<SuccessPayload | null>(null)

  function reset() {
    setStep("services")
    setState({})
    setSuccess(null)
  }

  return (
    <main className="border-b border-border">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <div className="text-center mb-10">
          <div className="gold-divider mx-auto max-w-xs mb-4">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl text-gold tracking-[0.08em]">
            MARCAR
          </h1>
          <p className="text-muted mt-3 text-sm">
            {step === "success"
              ? "Marcação enviada com sucesso."
              : `Passo ${stepNumber(step)} de ${STEPS.length}`}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background-elevated p-6 sm:p-8">
          {step === "services" && (
            <ServicesStep
              initial={state.services ?? []}
              onPick={(services) => {
                setState((s) => ({ ...s, services }))
                setStep("location")
              }}
            />
          )}

          {step === "location" && state.services && (
            <LocationStep
              services={state.services}
              onBack={() => setStep("services")}
              onPick={(location) => {
                setState((s) => ({ ...s, location }))
                setStep("date")
              }}
            />
          )}

          {step === "date" && state.location && state.services && (
            <DateStep
              services={state.services}
              location={state.location}
              onBack={() => setStep("location")}
              onPick={(date) => {
                setState((s) => ({ ...s, date }))
                setStep("slot")
              }}
            />
          )}

          {step === "slot" &&
            state.location &&
            state.services &&
            state.date && (
              <SlotStep
                services={state.services}
                location={state.location}
                date={state.date}
                onBack={() => setStep("date")}
                onChangeLocation={() => setStep("location")}
                onJumpToDate={(date) =>
                  setState((s) => ({ ...s, date }))
                }
                onPick={(slotIso) => {
                  setState((s) => ({ ...s, slotIso }))
                  setStep("details")
                }}
              />
            )}

          {step === "details" && (
            <DetailsStep
              initial={{
                name: state.name ?? "",
                phone: state.phone ?? "",
                email: state.email ?? "",
                notes: state.notes ?? "",
              }}
              onBack={() => setStep("slot")}
              onSubmit={(data) => {
                setState((s) => ({ ...s, ...data }))
                setStep("confirm")
              }}
            />
          )}

          {step === "confirm" &&
            state.location &&
            state.services &&
            state.slotIso && (
              <ConfirmStep
                state={state as Required<BookingState>}
                onBack={() => setStep("details")}
                onSuccess={(payload) => {
                  setSuccess(payload)
                  setStep("success")
                }}
              />
            )}

          {step === "success" && success && (
            <SuccessStep payload={success} onReset={reset} />
          )}
        </div>
      </div>
    </main>
  )
}

function stepNumber(step: Step): number {
  return Math.min(STEPS.indexOf(step) + 1, STEPS.length)
}

function ServiceIcon({ id, className }: { id: string; className?: string }) {
  switch (id) {
    case "corte":
      return <Scissors className={className} />
    case "barba":
      return <Sparkles className={className} />
    case "sobrancelha":
      return <Star className={className} />
    case "alinhamento":
      return <Award className={className} />
    default:
      return <Scissors className={className} />
  }
}

// ---------- STEP 1: services (multi-select) ----------
function ServicesStep({
  initial,
  onPick,
}: {
  initial: ServiceId[]
  onPick: (s: ServiceId[]) => void
}) {
  const [selected, setSelected] = useState<Set<ServiceId>>(new Set(initial))

  const validation = useMemo(() => validateSelection([...selected]), [selected])
  const combo = useMemo(
    () => (validation.ok && selected.size > 0 ? buildCombo([...selected]) : null),
    [validation, selected],
  )

  function toggle(id: ServiceId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <h2 className="text-xl mb-5 font-display tracking-wider">
        Que serviços queres?
      </h2>
      <p className="text-sm text-muted mb-5">
        Podes escolher mais do que um. Combos têm preço reduzido.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {SERVICES.map((s) => {
          const isSelected = selected.has(s.id as ServiceId)
          const conflict =
            s.id === "alinhamento" && selected.has("corte")
          const marginal = marginalPrice([...selected], s.id as ServiceId)
          const hasDiscount =
            !isSelected && !conflict && marginal < s.priceEur - 0.01

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id as ServiceId)}
              className={cn(
                "card-lift relative rounded-lg border border-border bg-background p-4 text-left",
                isSelected && "card-selected",
              )}
            >
              <div
                className={cn(
                  "absolute top-3 right-3 h-5 w-5 rounded border flex items-center justify-center",
                  isSelected ? "border-gold bg-gold text-black" : "border-border",
                )}
              >
                {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </div>

              <div className="flex items-center gap-2 pr-7">
                <ServiceIcon id={s.id} className="h-5 w-5 text-gold" />
                <span className="font-semibold">{s.name}</span>
              </div>
              <div className="mt-1 text-xs text-muted pr-7 leading-relaxed">
                {s.description}
              </div>
              <div className="mt-3 flex items-baseline justify-between text-sm">
                <span className="text-muted">
                  {s.durationMin} min{hasDiscount ? " · com combo" : ""}
                </span>
                {hasDiscount ? (
                  <span className="inline-flex items-baseline gap-2">
                    <span className="text-xs text-muted line-through">
                      {formatPrice(s.priceEur)}
                    </span>
                    <span className="font-display text-gold">
                      {formatPrice(marginal)}
                    </span>
                  </span>
                ) : (
                  <span className="font-display text-gold">
                    {formatPrice(s.priceEur)}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {!validation.ok && (
        <div className="mt-5 flex gap-3 text-danger text-sm rounded-md border border-danger/40 bg-danger/5 p-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{validation.error}</span>
        </div>
      )}

      {combo && (
        <div className="mt-5 rounded-lg border border-gold/40 bg-gold/5 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="font-display text-lg text-gold">{combo.name}</div>
              <div className="text-xs text-muted mt-0.5">
                {combo.durationMin} minutos
              </div>
            </div>
            <div className="font-display text-2xl text-gold">
              {formatPrice(combo.priceEur)}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          disabled={!combo}
          onClick={() => combo && onPick([...selected])}
          className={cn(
            "btn-gold rounded-md px-6 py-2.5 inline-flex items-center gap-2",
            !combo && "opacity-50 cursor-not-allowed",
          )}
        >
          Continuar <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ---------- STEP 2: location ----------
function LocationStep({
  services,
  onPick,
  onBack,
}: {
  services: ServiceId[]
  onPick: (id: LocationId) => void
  onBack: () => void
}) {
  const combo = buildCombo(services)
  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 className="text-xl mb-1 font-display tracking-wider">
        Onde queres cortar?
      </h2>
      <p className="text-xs text-muted mb-5">
        {combo.name} · {combo.durationMin} min · {formatPrice(combo.priceEur)}
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {LOCATIONS.map((loc) => (
          <button
            key={loc.id}
            onClick={() => onPick(loc.id)}
            className="card-lift group rounded-lg border border-border bg-background p-6 text-left"
          >
            <div className="flex items-center gap-3">
              <MapPin className="h-6 w-6 text-gold" />
              <span className="font-display text-2xl tracking-[0.1em] text-gold">
                {loc.name.toUpperCase()}
              </span>
            </div>
            <div className="mt-3 text-sm text-muted">
              {loc.id === "setubal"
                ? "Seg–Qui em horário alargado · Sex 14h–15h"
                : "Sex 17h–20h · Sáb 10h–12h30"}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------- STEP 3: date ----------
function DateStep({
  services,
  location,
  onPick,
  onBack,
}: {
  services: ServiceId[]
  location: LocationId
  onPick: (date: string) => void
  onBack: () => void
}) {
  const [date, setDate] = useState(todayLocal())
  const combo = buildCombo(services)
  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 className="text-xl mb-2 font-display tracking-wider">Que dia?</h2>
      <p className="text-muted mb-5 text-sm">
        {combo.name} · {location === "lisboa" ? "Lisboa" : "Setúbal"}
      </p>
      <input
        type="date"
        value={date}
        min={todayLocal()}
        max={maxDateLocal()}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-4 py-3 text-foreground focus:border-gold focus:outline-none"
      />
      <div className="mt-6 flex justify-end">
        <button onClick={() => onPick(date)} className="btn-gold rounded-md px-6 py-2.5">
          Ver horários
        </button>
      </div>
    </div>
  )
}

// ---------- STEP 4: slot ----------
function SlotStep({
  services,
  location,
  date,
  onPick,
  onBack,
  onChangeLocation,
  onJumpToDate,
}: {
  services: ServiceId[]
  location: LocationId
  date: string
  onPick: (slotIso: string) => void
  onBack: () => void
  onChangeLocation: () => void
  onJumpToDate: (date: string) => void
}) {
  const [slots, setSlots] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSlots(null)
    setError(null)
    const url = `/api/slots?location=${location}&date=${date}&services=${services.join(",")}`
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text())
        return r.json()
      })
      .then((d) => {
        if (!cancelled) setSlots(d.slots ?? [])
      })
      .catch((e) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [location, services, date])

  const locationName = location === "lisboa" ? "Lisboa" : "Setúbal"
  const otherLocation = location === "lisboa" ? "setubal" : "lisboa"
  const otherLocationName = otherLocation === "lisboa" ? "Lisboa" : "Setúbal"
  const dateFormatted = formatLisbon(
    new Date(`${date}T12:00:00Z`),
    "EEEE, dd 'de' MMMM",
  )

  // Detect if the location is closed on the chosen day-of-week (so we can
  // show a clearer message + suggest the next day this location actually opens).
  const dow = getLisbonDayOfWeek(date)
  const locationClosedThisDay = !isLocationOpenOn(location, dow)
  const nextOpen = locationClosedThisDay
    ? getNextOpenDate(location, date)
    : null
  const nextOpenFormatted = nextOpen
    ? formatLisbon(
        new Date(`${nextOpen}T12:00:00Z`),
        "EEEE, dd 'de' MMMM",
      )
    : null

  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 className="text-xl mb-5 font-display tracking-wider">
        Escolhe horário
      </h2>
      {slots === null && !error && (
        <div className="text-muted">A carregar horários…</div>
      )}
      {error && <div className="text-danger text-sm">Erro: {error}</div>}

      {slots && slots.length === 0 && (
        <div className="rounded-lg border border-border bg-background p-5">
          <p className="font-display text-lg text-gold mb-2">
            Sem horários disponíveis
          </p>
          {locationClosedThisDay ? (
            <p className="text-sm text-foreground/80">
              Em <strong>{dateFormatted}</strong> não estamos em{" "}
              <strong>{locationName}</strong>.{" "}
              {nextOpenFormatted && (
                <>
                  A próxima data com {locationName} é{" "}
                  <strong>{nextOpenFormatted}</strong>.
                </>
              )}
            </p>
          ) : (
            <p className="text-sm text-foreground/80">
              <strong>{locationName}</strong> não tem horários livres em{" "}
              <strong>{dateFormatted}</strong> — os slots desse dia já estão
              ocupados ou não cabem na duração do serviço.
            </p>
          )}
          <p className="text-sm text-muted mt-3">Sugestões:</p>
          <div className="mt-3 flex flex-col sm:flex-row gap-2 flex-wrap">
            {nextOpen && nextOpenFormatted && (
              <button
                onClick={() => onJumpToDate(nextOpen)}
                className="rounded-md bg-gold text-black px-4 py-2 text-sm font-semibold hover:brightness-110 transition"
              >
                Ver horários em {nextOpenFormatted}
              </button>
            )}
            <button
              onClick={onBack}
              className="rounded-md border border-border bg-background-elevated px-4 py-2 text-sm hover:border-gold hover:text-gold transition"
            >
              Tentar outra data
            </button>
            <button
              onClick={onChangeLocation}
              className="rounded-md border border-border bg-background-elevated px-4 py-2 text-sm hover:border-gold hover:text-gold transition"
            >
              Tentar em {otherLocationName}
            </button>
          </div>
        </div>
      )}

      {slots && slots.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slots.map((iso) => (
            <button
              key={iso}
              onClick={() => onPick(iso)}
              className="rounded-md border border-border bg-background px-3 py-2.5 hover:border-gold hover:text-gold hover:bg-background-elevated transition font-mono text-sm"
            >
              {formatLisbon(new Date(iso), "HH:mm")}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- STEP 5: details ----------
function DetailsStep({
  initial,
  onSubmit,
  onBack,
}: {
  initial: { name: string; phone: string; email: string; notes: string }
  onSubmit: (data: {
    name: string
    phone: string
    email: string
    notes?: string
  }) => void
  onBack: () => void
}) {
  const [name, setName] = useState(initial.name)
  const [phone, setPhone] = useState(initial.phone)
  const [email, setEmail] = useState(initial.email)
  const [notes, setNotes] = useState(initial.notes)
  const [err, setErr] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cleanPhone = phone.replace(/[^\d]/g, "")
    const cleanEmail = email.trim()
    if (name.trim().length < 2) return setErr("Nome demasiado curto")
    if (!/^\d{9,15}$/.test(cleanPhone))
      return setErr("Telefone inválido (9-15 dígitos, sem +)")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      return setErr("Email inválido")
    onSubmit({
      name: name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <BackButton onClick={onBack} />
      <h2 className="text-xl mb-5 font-display tracking-wider">Os teus dados</h2>
      <div className="space-y-3">
        <Field label="Nome">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="João Silva"
            className="w-full rounded-md border border-border bg-background px-4 py-2 focus:border-gold focus:outline-none"
          />
        </Field>
        <Field label="Telemóvel (com indicativo, sem +)">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
            placeholder="351912345678"
            className="w-full rounded-md border border-border bg-background px-4 py-2 focus:border-gold focus:outline-none"
          />
        </Field>
        <Field label="Email (para confirmação)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            inputMode="email"
            placeholder="joao@exemplo.com"
            className="w-full rounded-md border border-border bg-background px-4 py-2 focus:border-gold focus:outline-none"
          />
        </Field>
        <Field label="Notas (opcional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-4 py-2 focus:border-gold focus:outline-none"
          />
        </Field>
      </div>
      {err && <div className="mt-3 text-danger text-sm">{err}</div>}
      <div className="mt-6 flex justify-end">
        <button type="submit" className="btn-gold rounded-md px-6 py-2.5">
          Continuar
        </button>
      </div>
    </form>
  )
}

// ---------- STEP 6: confirm ----------
function ConfirmStep({
  state,
  onBack,
  onSuccess,
}: {
  state: Required<BookingState>
  onBack: () => void
  onSuccess: (p: SuccessPayload) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const combo: Combo = useMemo(() => buildCombo(state.services), [state.services])

  const whenLocal = useMemo(
    () =>
      formatLisbon(new Date(state.slotIso), "EEEE, dd/MM/yyyy 'às' HH:mm"),
    [state.slotIso],
  )

  async function confirm() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: state.location,
          services: state.services,
          startUtcIso: state.slotIso,
          client: {
            name: state.name,
            phone: state.phone,
            email: state.email,
          },
          notes: state.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro desconhecido")
      onSuccess({
        bookingId: json.booking.id,
        clientToken: json.booking.clientToken,
        whenLocal: json.booking.whenLocal,
        serviceName: json.booking.service,
        priceEur: json.booking.priceEur,
        location: state.location,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 className="text-xl mb-5 font-display tracking-wider">
        Confirma os dados
      </h2>
      <div className="rounded-lg border border-border bg-background p-5 space-y-2">
        <Row
          label="Localização"
          value={state.location === "lisboa" ? "Lisboa" : "Setúbal"}
        />
        <Row label="Serviço" value={`${combo.name} (${combo.durationMin} min)`} />
        <Row label="Preço" value={formatPrice(combo.priceEur)} />
        <Row label="Quando" value={whenLocal} />
        <Row label="Cliente" value={`${state.name} · ${state.phone}`} />
        <Row label="Email" value={state.email} />
        {state.notes && <Row label="Notas" value={state.notes} />}
      </div>
      <p className="mt-4 text-sm text-muted">
        Pagamento no local: <strong className="text-foreground">MBWay</strong> ou{" "}
        <strong className="text-foreground">dinheiro</strong>.
      </p>
      {error && <div className="mt-3 text-danger text-sm">{error}</div>}
      <div className="mt-6 flex justify-end">
        <button
          disabled={submitting}
          onClick={confirm}
          className={cn(
            "btn-gold rounded-md px-6 py-2.5",
            submitting && "opacity-50 cursor-wait",
          )}
        >
          {submitting ? "A confirmar…" : "Confirmar marcação"}
        </button>
      </div>
    </div>
  )
}

// ---------- STEP 7: success ----------
function SuccessStep({
  payload,
  onReset,
}: {
  payload: SuccessPayload
  onReset: () => void
}) {
  const shopPhone = process.env.NEXT_PUBLIC_SHOP_PHONE
  const viewUrl = `/marcacao/${payload.bookingId}?token=${payload.clientToken}`
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold">
        <Sparkles className="h-7 w-7 text-gold" />
      </div>
      <div className="font-display text-3xl tracking-[0.1em] text-gold mb-2">
        MARCAÇÃO ENVIADA
      </div>
      <p className="text-foreground/80 mt-2">{payload.whenLocal}</p>
      <p className="mt-1 text-muted">
        {payload.serviceName} · {formatPrice(payload.priceEur)} ·{" "}
        {payload.location === "lisboa" ? "Lisboa" : "Setúbal"}
      </p>
      <p className="mt-5 text-sm text-muted">
        Status: <span className="text-gold">PENDENTE</span> — já te enviámos um
        email com os detalhes e vais receber outro assim que o barbeiro a
        aprovar.
      </p>
      <p className="mt-3 text-xs text-muted/80">
        Não vês o email passados alguns minutos? Verifica a pasta de{" "}
        <strong className="text-foreground/90">spam / lixo eletrónico</strong>{" "}
        e marca como &ldquo;Não é spam&rdquo; para garantir que recebes os
        próximos.
      </p>

      <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
        <a
          href={viewUrl}
          className="rounded-md border border-gold/40 px-6 py-2.5 text-gold hover:bg-gold/10 transition"
        >
          Ver detalhes da marcação
        </a>
        {shopPhone && (
          <a
            href={`https://wa.me/${shopPhone}`}
            target="_blank"
            rel="noopener"
            className="rounded-md bg-[#25D366] px-6 py-2.5 font-semibold text-black hover:brightness-110 transition"
          >
            Falar no WhatsApp
          </a>
        )}
      </div>

      <div className="mt-6">
        <button
          onClick={onReset}
          className="text-gold underline text-sm hover:text-gold-bright"
        >
          Fazer outra marcação
        </button>
      </div>
    </div>
  )
}

// ---------- atoms ----------
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-gold transition"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar
    </button>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm text-muted mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  )
}
