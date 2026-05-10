import Link from "next/link"
import { ChevronRight, MapPin, Clock, Award } from "lucide-react"
import { BackgroundLogo } from "@/components/BackgroundLogo"

export default function HomePage() {
  return (
    <>
      <Hero />
      <Pillars />
    </>
  )
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <BackgroundLogo />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-24 sm:py-32 text-center">
        <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-[0.08em] text-gold leading-none">
          TARZAN&apos;S
        </h1>
        <p className="mt-2 font-display text-2xl sm:text-3xl tracking-[0.2em] text-foreground">
          BARBERSHOP
        </p>

        <p className="mt-10 text-foreground/80 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Barbearia clássica em <span className="text-gold">Lisboa</span> e{" "}
          <span className="text-gold">Setúbal</span>. Cortes precisos,
          atendimento meticuloso e agenda online com confirmação imediata.
        </p>

        <div className="mt-14 flex justify-center">
          <Link href="/marcar" className="btn-cta-block">
            MARCAR AGORA
            <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.5} />
          </Link>
        </div>

        <div className="mt-12">
          <Link
            href="/servicos"
            className="text-sm text-muted hover:text-gold transition inline-flex items-center gap-1.5"
          >
            Ver serviços disponíveis
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}

function Pillars() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-20 grid sm:grid-cols-3 gap-6">
        <Pillar
          icon={<MapPin className="h-6 w-6" />}
          title="DUAS LOCALIZAÇÕES"
          body="Lisboa e Setúbal, com horários distintos para se adaptarem à tua semana."
        />
        <Pillar
          icon={<Clock className="h-6 w-6" />}
          title="MARCAÇÃO IMEDIATA"
          body="Agenda online disponível a qualquer hora, com confirmação automática por WhatsApp."
        />
        <Pillar
          icon={<Award className="h-6 w-6" />}
          title="CARTÃO FIDELIDADE"
          body="Cartão entregue na primeira visita. Ao sexto corte, oferta total."
        />
      </div>
    </section>
  )
}

function Pillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 text-gold">
        {icon}
      </div>
      <h3 className="font-display text-base tracking-[0.15em] text-gold">{title}</h3>
      <p className="mt-2 text-sm text-foreground/75 leading-relaxed">{body}</p>
    </div>
  )
}
