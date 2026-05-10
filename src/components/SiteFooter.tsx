import Image from "next/image"
import { AlertTriangle, CreditCard, Award, XCircle } from "lucide-react"

/**
 * Bottom of every page: Políticas section (cream) + footer.
 * Render once in the root layout.
 */
export function SiteFooter() {
  return (
    <>
      <PoliciesSection />
      <Footer />
    </>
  )
}

function PoliciesSection() {
  return (
    <section className="section-cream border-y border-cream-border">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center mb-10">
          <div className="gold-divider mx-auto max-w-xs mb-3">
            <Award className="h-4 w-4" />
          </div>
          <h2 className="font-display text-3xl sm:text-4xl tracking-[0.08em] text-gold-dim">
            POLÍTICAS DA CASA
          </h2>
          <p className="mt-2 opacity-70 text-sm">
            Regras simples para que tudo corra bem.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          <PolicyCard
            icon={<AlertTriangle className="h-5 w-5" />}
            title="ATRASOS"
            body="Em caso de atraso superior a 20 minutos, a marcação poderá ser cancelada para preservar o horário dos clientes seguintes."
          />
          <PolicyCard
            icon={<XCircle className="h-5 w-5" />}
            title="CANCELAMENTO"
            body="Cancela com pelo menos 12 horas de antecedência através do link no email de confirmação. Cancelamentos tardios e faltas repetidas podem afetar marcações futuras."
          />
          <PolicyCard
            icon={<CreditCard className="h-5 w-5" />}
            title="PAGAMENTO"
            body="Efetuado no local, em MBWay ou dinheiro. Não é cobrado qualquer valor antecipadamente."
          />
          <PolicyCard
            icon={<Award className="h-5 w-5" />}
            title="FIDELIZAÇÃO"
            body="Cartão entregue na primeira visita. Ao sexto corte, ganhas um totalmente gratuito! Programa válido apenas para o primeiro cartão. Uma vez completo, o agradecimento fica feito."
          />
        </div>
      </div>
    </section>
  )
}

function PolicyCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-lg border border-cream-border bg-white/40 p-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="text-gold-dim">{icon}</div>
        <div className="font-display text-lg tracking-[0.1em] text-gold-dim">
          {title}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{body}</p>
    </div>
  )
}

function Footer() {
  return (
    <footer className="bg-background-deep">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.jpeg"
            alt="Tarzan's"
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="font-display tracking-[0.2em] text-gold text-sm">
            TARZAN&apos;S BARBERSHOP
          </span>
        </div>
        <div className="text-xs text-muted">
          © {new Date().getFullYear()} · Lisboa &amp; Setúbal
        </div>
      </div>
    </footer>
  )
}
