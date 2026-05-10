import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Tarzan's Barbershop <onboarding@resend.dev>"

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

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return "http://localhost:3001"
}

// ---------- helpers ----------

/** Format Date for Google Calendar URL (YYYYMMDDTHHmmssZ) */
function gcalDateString(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

function gcalAddUrl(opts: {
  title: string
  start: Date
  end: Date
  details: string
  location: string
}): string {
  const dates = `${gcalDateString(opts.start)}/${gcalDateString(opts.end)}`
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates,
    details: opts.details,
    location: opts.location,
  })
  return `https://www.google.com/calendar/render?${params.toString()}`
}

function priceFormat(p: number): string {
  return p.toFixed(2).replace(".", ",") + " €"
}

function escape(s: string | null | undefined): string {
  if (!s) return ""
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Returns an HTML <a> tag for "Falar no WhatsApp" if NEXT_PUBLIC_SHOP_PHONE
 * is configured. Returns empty string otherwise — caller can interpolate
 * unconditionally.
 */
function whatsappButtonHtml(prefilledMessage?: string): string {
  const phone = process.env.NEXT_PUBLIC_SHOP_PHONE
  if (!phone) return ""
  const url = prefilledMessage
    ? `https://wa.me/${phone}?text=${encodeURIComponent(prefilledMessage)}`
    : `https://wa.me/${phone}`
  return `<a href="${url}" target="_blank" style="display:inline-block;background:#25D366;color:#0a3d2c;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:700;margin:4px;">💬 Falar no WhatsApp</a>`
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
  /** Pretty location name, e.g. "Lisboa" */
  location: string
  /** Pretty datetime string, e.g. "segunda, 12 de maio às 14:00" */
  whenLocal: string
  /** Booking start in UTC — used for Google Calendar URL */
  startUtc: Date
  /** Booking end in UTC */
  endUtc: Date
  notes?: string | null
  adminToken: string
  clientToken: string
}

const headerHtml = `<div style="background:#1a1411;color:#f5e9d0;padding:24px;border-radius:8px 8px 0 0;text-align:center;">
  <div style="font-family:Georgia,serif;color:#f5c518;font-size:22px;letter-spacing:0.2em;font-weight:700;">TARZAN'S BARBERSHOP</div>
</div>`

const baseStyle =
  "margin:0;padding:24px;background:#f3f0ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1411;"

/** Email sent to barber when a customer creates a new booking (PENDING) */
export function adminBookingEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const site = getSiteUrl()
  const confirmUrl = `${site}/api/admin/bookings/${booking.id}/confirm?token=${booking.adminToken}`
  const rejectUrl = `${site}/api/admin/bookings/${booking.id}/reject?token=${booking.adminToken}`

  const subject = `Nova marcação pendente — ${booking.serviceName} ${booking.whenLocal}`
  const html = `<!DOCTYPE html>
<html><body style="${baseStyle}">
  <div style="max-width:600px;margin:0 auto;">
    ${headerHtml}
    <div style="background:white;padding:28px;border-radius:0 0 8px 8px;">
      <div style="color:#a89880;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Nova marcação pendente</div>
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
</body></html>`
  return { subject, html }
}

/**
 * Email sent to the customer right after they create a booking (status PENDING).
 * Confirms the booking is being reviewed by the barber and gives the customer
 * a way to track its status (private link) or follow up directly (WhatsApp).
 */
export function clientReceivedEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const site = getSiteUrl()
  const statusUrl = `${site}/marcacao/${booking.id}?token=${booking.clientToken}`
  const waMessage = `Olá! Fiz uma marcação para ${booking.serviceName} no dia ${booking.whenLocal}, em ${booking.location}. Obrigado!`
  const waButton = whatsappButtonHtml(waMessage)

  const subject = `Recebemos a tua marcação — Tarzan's Barbershop`
  const html = `<!DOCTYPE html>
<html><body style="${baseStyle}">
  <div style="max-width:600px;margin:0 auto;">
    ${headerHtml}
    <div style="background:white;padding:32px 28px;border-radius:0 0 8px 8px;">
      <p style="margin:0 0 12px 0;font-size:16px;">Olá, <strong>${escape(booking.clientName)}</strong>!</p>
      <p style="margin:0 0 12px 0;font-size:16px;">Recebemos a tua marcação. Está agora a aguardar confirmação do barbeiro — vais receber outro email assim que ele aprovar (normalmente dentro de algumas horas).</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:20px 0;">
        <tr><td style="padding:8px 0;color:#666;width:35%;">Serviço</td><td style="padding:8px 0;font-weight:600;">${booking.serviceName}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Quando</td><td style="padding:8px 0;font-weight:600;">${booking.whenLocal}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Localização</td><td style="padding:8px 0;">${booking.location}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Duração</td><td style="padding:8px 0;">${booking.durationMin} min</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Preço</td><td style="padding:8px 0;">${priceFormat(booking.priceEur)}</td></tr>
      </table>

      <p style="margin:0 0 8px 0;font-size:14px;color:#666;">Status atual: <strong style="color:#c79c0e;">PENDENTE</strong></p>

      <div style="text-align:center;margin-top:24px;">
        <a href="${statusUrl}" style="display:inline-block;background:#1a1411;color:#f5c518;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin:4px;">Ver estado da marcação</a>
        ${waButton ? `<br>${waButton}` : ""}
      </div>

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#999;line-height:1.6;">
        Guarda este email — o link acima permite-te acompanhar o estado da marcação a qualquer altura. Se este email tiver chegado ao spam, marca como &ldquo;não é spam&rdquo; para garantir que recebes os próximos.
      </div>
    </div>

    <div style="text-align:center;color:#999;font-size:12px;margin-top:14px;">
      Tarzan's Barbershop · Lisboa &amp; Setúbal
    </div>
  </div>
</body></html>`
  return { subject, html }
}

/** Email sent to the customer once the barber has confirmed */
export function clientConfirmedEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const site = getSiteUrl()
  const cancelUrl = `${site}/api/bookings/${booking.id}/cancel?token=${booking.clientToken}`

  const calendarTitle = `Tarzan's Barbershop — ${booking.serviceName}`
  const calendarDetails = `${booking.serviceName} (${booking.durationMin} min · ${priceFormat(booking.priceEur)})\nID: ${booking.id}`
  const gcalUrl = gcalAddUrl({
    title: calendarTitle,
    start: booking.startUtc,
    end: booking.endUtc,
    details: calendarDetails,
    location: booking.location,
  })

  const subject = `Marcação confirmada — Tarzan's Barbershop`
  const html = `<!DOCTYPE html>
<html><body style="${baseStyle}">
  <div style="max-width:600px;margin:0 auto;">
    ${headerHtml}
    <div style="background:white;padding:32px 28px;border-radius:0 0 8px 8px;">
      <p style="margin:0 0 12px 0;font-size:16px;">Olá, <strong>${escape(booking.clientName)}</strong>!</p>
      <p style="margin:0 0 12px 0;font-size:16px;">A sua marcação para Tarzan's Barbershop foi confirmada com sucesso.</p>
      <p style="margin:0 0 28px 0;font-size:16px;"><strong>Data da marcação:</strong> ${booking.whenLocal}</p>

      <div style="text-align:center;">
        <a href="${gcalUrl}" target="_blank" style="display:inline-block;background:#1a73e8;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin:4px;">📅 Adicionar ao Google Calendar</a>
        ${whatsappButtonHtml() ? `<br>${whatsappButtonHtml()}` : ""}
        <br>
        <a href="${cancelUrl}" style="display:inline-block;background:transparent;color:#c1272d;text-decoration:none;padding:10px 20px;border:1px solid #c1272d;border-radius:6px;font-weight:600;margin:8px 4px;">✗ Cancelar marcação</a>
      </div>

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#999;line-height:1.6;">
        Por favor cancela com pelo menos 12 horas de antecedência se não puderes comparecer.
        Em caso de atraso superior a 20 minutos a marcação poderá ser cancelada para preservar o horário dos clientes seguintes.
      </div>
    </div>

    <div style="text-align:center;color:#999;font-size:12px;margin-top:14px;">
      Tarzan's Barbershop · Lisboa &amp; Setúbal
    </div>
  </div>
</body></html>`
  return { subject, html }
}

/** Reminder sent ~24h before a confirmed booking */
export function clientReminderEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const site = getSiteUrl()
  const cancelUrl = `${site}/api/bookings/${booking.id}/cancel?token=${booking.clientToken}`

  const calendarTitle = `Tarzan's Barbershop — ${booking.serviceName}`
  const calendarDetails = `${booking.serviceName} (${booking.durationMin} min · ${priceFormat(booking.priceEur)})\nID: ${booking.id}`
  const gcalUrl = gcalAddUrl({
    title: calendarTitle,
    start: booking.startUtc,
    end: booking.endUtc,
    details: calendarDetails,
    location: booking.location,
  })

  const subject = `Lembrete: marcação amanhã — Tarzan's Barbershop`
  const html = `<!DOCTYPE html>
<html><body style="${baseStyle}">
  <div style="max-width:600px;margin:0 auto;">
    ${headerHtml}
    <div style="background:white;padding:32px 28px;border-radius:0 0 8px 8px;">
      <p style="margin:0 0 12px 0;font-size:16px;">Olá, <strong>${escape(booking.clientName)}</strong>!</p>
      <p style="margin:0 0 12px 0;font-size:16px;">Lembramos que tem uma marcação no Tarzan's Barbershop em aproximadamente <strong>24 horas</strong>.</p>
      <p style="margin:0 0 8px 0;font-size:16px;"><strong>Quando:</strong> ${booking.whenLocal}</p>
      <p style="margin:0 0 8px 0;font-size:16px;"><strong>Serviço:</strong> ${booking.serviceName} (${booking.durationMin} min)</p>
      <p style="margin:0 0 28px 0;font-size:16px;"><strong>Localização:</strong> ${booking.location}</p>

      <div style="text-align:center;">
        <a href="${gcalUrl}" target="_blank" style="display:inline-block;background:#1a73e8;color:white;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;margin:4px;">📅 Adicionar ao Google Calendar</a>
        ${whatsappButtonHtml() ? `<br>${whatsappButtonHtml()}` : ""}
        <br>
        <a href="${cancelUrl}" style="display:inline-block;background:transparent;color:#c1272d;text-decoration:none;padding:10px 20px;border:1px solid #c1272d;border-radius:6px;font-weight:600;margin:8px 4px;">✗ Cancelar marcação</a>
      </div>

      <div style="margin-top:24px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#999;line-height:1.6;">
        Se já não puder comparecer, cancele agora pelo botão acima — outros clientes poderão aproveitar o horário.
      </div>
    </div>
  </div>
</body></html>`
  return { subject, html }
}

/** Email sent when the barber cancels a booking */
export function clientCancelledEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const subject = `Marcação cancelada — Tarzan's Barbershop`
  const html = `<!DOCTYPE html>
<html><body style="${baseStyle}">
  <div style="max-width:600px;margin:0 auto;background:white;padding:28px;border-radius:8px;">
    <div style="font-family:Georgia,serif;color:#f5c518;font-size:18px;letter-spacing:0.2em;font-weight:700;text-align:center;">TARZAN'S BARBERSHOP</div>
    <h2 style="color:#c1272d;margin-top:20px;">Marcação cancelada</h2>
    <p>Olá ${escape(booking.clientName)},</p>
    <p>Lamentamos informar que a sua marcação foi <strong>cancelada</strong>:</p>
    <ul style="padding-left:20px;line-height:1.8;">
      <li>${booking.serviceName}</li>
      <li>${booking.whenLocal}</li>
      <li>${booking.location}</li>
    </ul>
    <p>Pode fazer nova marcação em qualquer altura no nosso site.</p>
    ${whatsappButtonHtml()
      ? `<div style="text-align:center;margin:20px 0;">${whatsappButtonHtml()}</div>`
      : ""}
    <div style="text-align:center;color:#999;font-size:12px;margin-top:20px;">
      Tarzan's Barbershop · Lisboa &amp; Setúbal
    </div>
  </div>
</body></html>`
  return { subject, html }
}

/** Email sent to admin when the customer cancels via the email link */
export function adminCancelledByClientEmail(booking: BookingForEmail): {
  subject: string
  html: string
} {
  const subject = `Cliente cancelou — ${booking.serviceName} ${booking.whenLocal}`
  const html = `<!DOCTYPE html>
<html><body style="${baseStyle}">
  <div style="max-width:600px;margin:0 auto;background:white;padding:28px;border-radius:8px;">
    <div style="font-family:Georgia,serif;color:#f5c518;font-size:18px;letter-spacing:0.2em;font-weight:700;text-align:center;">TARZAN'S BARBERSHOP</div>
    <h2 style="color:#c1272d;margin-top:20px;">Cliente cancelou marcação</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#666;">Cliente</td><td style="padding:6px 0;font-weight:600;">${escape(booking.clientName)}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Telefone</td><td style="padding:6px 0;">+${booking.clientPhone}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Serviço</td><td style="padding:6px 0;">${booking.serviceName}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Quando</td><td style="padding:6px 0;">${booking.whenLocal}</td></tr>
      <tr><td style="padding:6px 0;color:#666;">Localização</td><td style="padding:6px 0;">${booking.location}</td></tr>
    </table>
    <p style="font-size:12px;color:#999;margin-top:16px;">O slot ficou novamente disponível para outras marcações.</p>
  </div>
</body></html>`
  return { subject, html }
}
