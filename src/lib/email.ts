import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

/**
 * From address. Defaults to Resend's test sender. For production set
 * EMAIL_FROM to something on a verified domain (e.g. "Tarzan's <noreply@yourdomain.com>").
 */
const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Tarzan's Barbershop <onboarding@resend.dev>"

/**
 * Inbox where new-booking notifications land. The barber confirms by clicking
 * a link in the email.
 */
export const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL ?? "tarzans.barbershop@gmail.com"

interface SendOptions {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail(
  opts: SendOptions,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!resend) {
    console.warn("[email] No RESEND_API_KEY — skipping send to", opts.to)
    return { ok: false, error: "Email not configured" }
  }
  try {
    const result = await resend.emails.send({
      from: EMAIL_FROM,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
    })
    if (result.error) {
      console.error("[email] Resend error:", result.error)
      return { ok: false, error: result.error.message }
    }
    return { ok: true, id: result.data?.id }
  } catch (e) {
    console.error("[email] Send failed:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Unknown" }
  }
}

/**
 * Resolve the public site URL. Picks (in order):
 *   1. NEXT_PUBLIC_SITE_URL (manual override)
 *   2. VERCEL_PROJECT_PRODUCTION_URL (e.g. "barbershop-chi-rust.vercel.app")
 *   3. VERCEL_URL (preview deploys)
 *   4. localhost fallback for dev
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3001"
}

// ---------- Email templates ----------

export interface BookingForEmail {
  id: string
  clientName: string
  clientPhone: string
  clientEmail?: string | null
  serviceName: string
  durationMin: number
  priceEur: number
  location: string // pretty: "Lisboa" or "Setúbal"
  whenLocal: string // pretty: "segunda, 12 de maio às 14:00"
  notes?: string | null
  adminToken: string
  clientToken: string
}

function priceFormat(p: number): string {
  return p.toFixed(2).replace(".", ",") + " €"
}

/** Email sent to the barber when a customer creates a new booking */
export function adminBookingEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const site = getSiteUrl()
  const confirmUrl = `${site}/api/admin/bookings/${booking.id}/confirm?token=${booking.adminToken}`
  const rejectUrl = `${site}/api/admin/bookings/${booking.id}/reject?token=${booking.adminToken}`

  const subject = `Nova marcação pendente — ${booking.serviceName} ${booking.whenLocal}`
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f3f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1411;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="background:#1a1411;color:#f5e9d0;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
      <div style="font-family:Georgia,serif;color:#f5c518;font-size:22px;letter-spacing:0.2em;font-weight:700;">TARZAN'S BARBERSHOP</div>
      <div style="color:#a89880;font-size:13px;margin-top:4px;">Nova marcação pendente</div>
    </div>

    <div style="background:white;padding:28px;border-radius:0 0 8px 8px;">
      <h2 style="margin:0 0 16px 0;color:#c79c0e;font-family:Georgia,serif;letter-spacing:0.05em;">${booking.serviceName}</h2>

      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#666;width:35%;">Quando</td><td style="padding:8px 0;font-weight:600;">${booking.whenLocal}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Localização</td><td style="padding:8px 0;">${booking.location}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Duração</td><td style="padding:8px 0;">${booking.durationMin} minutos</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Preço</td><td style="padding:8px 0;">${priceFormat(booking.priceEur)}</td></tr>
        <tr><td colspan="2"><div style="border-top:1px solid #eee;margin:8px 0;"></div></td></tr>
        <tr><td style="padding:8px 0;color:#666;">Cliente</td><td style="padding:8px 0;font-weight:600;">${escape(booking.clientName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Telefone</td><td style="padding:8px 0;"><a href="tel:+${booking.clientPhone}" style="color:#1a1411;">+${booking.clientPhone}</a></td></tr>
        ${booking.clientEmail ? `<tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${escape(booking.clientEmail)}" style="color:#1a1411;">${escape(booking.clientEmail)}</a></td></tr>` : ""}
        ${booking.notes ? `<tr><td style="padding:8px 0;color:#666;">Notas</td><td style="padding:8px 0;font-style:italic;">${escape(booking.notes)}</td></tr>` : ""}
      </table>

      <div style="margin-top:28px;text-align:center;">
        <a href="${confirmUrl}" style="display:inline-block;background:#22c55e;color:white;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;letter-spacing:0.05em;margin:4px;">CONFIRMAR</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#ef4444;color:white;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:700;letter-spacing:0.05em;margin:4px;">CANCELAR</a>
      </div>

      <p style="font-size:11px;color:#999;text-align:center;margin-top:20px;margin-bottom:0;">Booking ID: ${booking.id}</p>
    </div>
  </div>
</body>
</html>`
  return { subject, html }
}

/** Email sent to the customer once the barber has confirmed */
export function clientConfirmedEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const site = getSiteUrl()
  const viewUrl = `${site}/marcacao/${booking.id}?token=${booking.clientToken}`

  const subject = `Marcação confirmada — ${booking.serviceName} (${booking.whenLocal})`
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f3f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1411;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="background:#1a1411;color:#f5e9d0;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
      <div style="font-family:Georgia,serif;color:#f5c518;font-size:22px;letter-spacing:0.2em;font-weight:700;">TARZAN'S BARBERSHOP</div>
      <div style="color:#22c55e;font-weight:700;font-size:18px;margin-top:10px;letter-spacing:0.04em;">✓ MARCAÇÃO CONFIRMADA</div>
    </div>

    <div style="background:white;padding:28px;border-radius:0 0 8px 8px;">
      <p style="margin-top:0;">Olá ${escape(booking.clientName)},</p>
      <p>A tua marcação foi <strong>confirmada</strong>. Estamos à tua espera.</p>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
        <tr><td style="padding:8px 0;color:#666;width:35%;">Serviço</td><td style="padding:8px 0;font-weight:600;">${booking.serviceName}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Quando</td><td style="padding:8px 0;font-weight:600;">${booking.whenLocal}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Localização</td><td style="padding:8px 0;">${booking.location}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Duração</td><td style="padding:8px 0;">${booking.durationMin} minutos</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Preço</td><td style="padding:8px 0;">${priceFormat(booking.priceEur)} · pagamento no local</td></tr>
      </table>

      <div style="background:#fff8dc;padding:14px 16px;border-radius:6px;margin-top:20px;font-size:13px;color:#5a4a20;">
        <strong>Lembra-te:</strong> em caso de atraso superior a 20 minutos, a marcação poderá ser cancelada para preservar o horário dos clientes seguintes.
      </div>

      <div style="margin-top:24px;text-align:center;">
        <a href="${viewUrl}" style="display:inline-block;background:#f5c518;color:#1a1411;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:700;letter-spacing:0.05em;">VER MARCAÇÃO ONLINE</a>
      </div>
    </div>

    <div style="text-align:center;color:#999;font-size:12px;margin-top:14px;">
      Tarzan's Barbershop · Lisboa &amp; Setúbal
    </div>
  </div>
</body>
</html>`
  return { subject, html }
}

/** Email sent to the customer when the barber cancels their booking */
export function clientCancelledEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const subject = `Marcação cancelada — ${booking.serviceName} (${booking.whenLocal})`
  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#f3f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1411;">
  <div style="max-width:600px;margin:0 auto;background:white;padding:28px;border-radius:8px;">
    <div style="font-family:Georgia,serif;color:#f5c518;font-size:18px;letter-spacing:0.2em;font-weight:700;text-align:center;">TARZAN'S BARBERSHOP</div>
    <h2 style="color:#ef4444;margin-top:20px;">Marcação cancelada</h2>
    <p>Olá ${escape(booking.clientName)},</p>
    <p>Lamentamos informar que a tua marcação foi <strong>cancelada</strong>:</p>
    <ul style="padding-left:20px;line-height:1.8;">
      <li>${booking.serviceName}</li>
      <li>${booking.whenLocal}</li>
      <li>${booking.location}</li>
    </ul>
    <p>Podes fazer nova marcação em qualquer altura no nosso site. Se tiveres alguma dúvida, contacta-nos.</p>
    <div style="text-align:center;color:#999;font-size:12px;margin-top:20px;">
      Tarzan's Barbershop · Lisboa &amp; Setúbal
    </div>
  </div>
</body>
</html>`
  return { subject, html }
}

// Tiny HTML escape helper
function escape(s: string | null | undefined): string {
  if (!s) return ""
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
