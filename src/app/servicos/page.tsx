"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  Scissors,
  Sparkles,
  Star,
  Award,
  Check,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import {
  SERVICES,
  buildCombo,
  validateSelection,
  formatPrice,
  type ServiceId,
} from "@/lib/services"
import { cn } from "@/lib/utils"

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

export default function ServicosPage() {
  const [selected, setSelected] = useState<Set<ServiceId>>(new Set())

  const validation = useMemo(() => validateSelection([...selected]), [selected])
  const combo = useMemo(
    () => (validation.ok && selected.size > 0 ? buildCombo([...selected]) : null),
    [validation, selected],
  )
  const errorMsg = !validation.ok ? validation.error : null

  function toggle(id: ServiceId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const linkHref =
    combo && validation.ok
      ? `/marcar?services=${[...selected].join(",")}`
      : "/marcar"

  return (
    <main>
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
          <div className="text-center mb-12">
            <div className="gold-divider mx-auto max-w-xs mb-4">
              <Scissors className="h-4 w-4" />
            </div>
            <h1 className="font-display text-4xl sm:text-5xl tracking-[0.08em] text-gold">
              SERVIÇOS
            </h1>
            <p className="mt-4 text-foreground/75 max-w-xl mx-auto">
              Seleciona um ou mais serviços. Combos têm preço reduzido.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {SERVICES.map((s) => {
              const isSelected = selected.has(s.id as ServiceId)
              const conflict =
                s.id === "alinhamento" && selected.has("corte")
              const conflictReverse =
                s.id === "corte" && selected.has("alinhamento")

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id as ServiceId)}
                  className={cn(
                    "card-lift relative rounded-lg border border-border bg-background-elevated p-5 text-left",
                    isSelected && "card-selected",
                    (conflict || conflictReverse) && !isSelected && "opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-4 right-4 h-5 w-5 rounded border flex items-center justify-center transition",
                      isSelected
                        ? "border-gold bg-gold text-black"
                        : "border-border",
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </div>

                  <div className="flex items-center gap-3">
                    <ServiceIcon id={s.id} className="h-6 w-6 text-gold" />
                    <span className="font-display text-xl tracking-wider">
                      {s.name}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-foreground/70 pr-8 leading-relaxed">
                    {s.description}
                  </p>

                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-xs text-muted">
                      {s.durationMin} min · individual
                    </span>
                    <span className="font-display text-lg text-gold">
                      {formatPrice(s.priceEur)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Combo summary / Error */}
          <div className="mt-8 rounded-lg border border-border bg-background-elevated p-6">
            {errorMsg && (
              <div className="flex gap-3 text-danger">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {!errorMsg && !combo && (
              <p className="text-muted text-center">
                Seleciona pelo menos um serviço para continuar.
              </p>
            )}

            {!errorMsg && combo && (
              <>
                <div className="text-xs uppercase tracking-[0.15em] text-muted mb-2">
                  Resumo da escolha
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <div className="font-display text-2xl text-gold tracking-wider">
                      {combo.name}
                    </div>
                    <div className="text-sm text-muted mt-1">
                      Duração estimada: {combo.durationMin} minutos
                    </div>
                  </div>
                  <div className="font-display text-3xl text-gold">
                    {formatPrice(combo.priceEur)}
                  </div>
                </div>

                {/* Show savings if there's a combo discount */}
                {(() => {
                  const sumIndividual = [...selected].reduce((acc, id) => {
                    const item = SERVICES.find((x) => x.id === id)
                    return acc + (item?.priceEur ?? 0)
                  }, 0)
                  const savings = sumIndividual - combo.priceEur
                  if (savings > 0.01) {
                    return (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-gold/10 px-3 py-1.5 text-sm text-gold">
                        <Award className="h-4 w-4" />
                        Poupas {formatPrice(savings)} com este combo.
                      </div>
                    )
                  }
                  return null
                })()}
              </>
            )}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <Link
              href="/"
              className="rounded-md border border-border px-6 py-3 text-foreground/80 hover:border-gold hover:text-gold transition text-center"
            >
              Voltar
            </Link>
            <Link
              href={linkHref}
              aria-disabled={!combo}
              onClick={(e) => {
                if (!combo) e.preventDefault()
              }}
              className={cn(
                "btn-gold rounded-md px-8 py-3 inline-flex items-center justify-center gap-2",
                !combo && "pointer-events-none opacity-50",
              )}
            >
              Continuar para marcação
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
