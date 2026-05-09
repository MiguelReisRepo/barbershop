// Admin session cookie — HMAC-signed timestamp.
// Format: "<expiresMs>.<signature>"
// Uses Web Crypto so it works in middleware (Edge runtime) and Node.

const SESSION_COOKIE = "tarzans-admin"
const TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  return process.env.ADMIN_SECRET ?? "INSECURE-DEFAULT-CHANGE-ME-IN-ENV"
}

function bytesToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function hmacHex(payload: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload))
  return bytesToHex(sig)
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export async function makeSessionValue(): Promise<string> {
  const expires = Date.now() + TTL_MS
  const sig = await hmacHex(`session:${expires}`)
  return `${expires}.${sig}`
}

export async function isSessionValid(
  value: string | undefined | null,
): Promise<boolean> {
  if (!value) return false
  const dot = value.indexOf(".")
  if (dot < 0) return false
  const expiresStr = value.slice(0, dot)
  const sig = value.slice(dot + 1)
  const expires = Number.parseInt(expiresStr, 10)
  if (!Number.isFinite(expires) || expires < Date.now()) return false
  const expected = await hmacHex(`session:${expires}`)
  return timingSafeEqualHex(sig, expected)
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_TTL_MS = TTL_MS
