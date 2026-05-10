// Service catalog + combo pricing logic.
//
// Customers can pick MULTIPLE services in one booking. Some combos have
// special prices (a discount over the sum of items). Special rules:
//  - "Alinhamento" can't be combined with "Corte" (alinhamento is already
//    included in a corte).
// Combo lookup keys are item ids sorted alphabetically and joined with "+".

export interface ServiceItem {
  id: ServiceId
  name: string
  description: string
  priceEur: number
  durationMin: number
}

export type ServiceId = "corte" | "barba" | "sobrancelha" | "alinhamento"

export const SERVICES: readonly ServiceItem[] = [
  {
    id: "corte",
    name: "Corte",
    description: "Corte completo à máquina e tesoura, finalizado com alinhamento.",
    priceEur: 10,
    durationMin: 45,
  },
  {
    id: "barba",
    name: "Barba",
    description: "Aparar, desenhar e finalizar com precisão.",
    priceEur: 5,
    durationMin: 30,
  },
  {
    id: "sobrancelha",
    name: "Sobrancelha",
    description: "Limpeza e definição da sobrancelha masculina.",
    priceEur: 5,
    durationMin: 15,
  },
  {
    id: "alinhamento",
    name: "Alinhamento",
    description:
      "Apenas contornos e acabamentos. Não é compatível com Corte (já incluído).",
    priceEur: 5,
    durationMin: 20,
  },
] as const

// Combo-specific price/duration overrides. Keys are item ids sorted
// alphabetically and joined by "+". Combos not listed here fall back to
// the sum of individual items (no discount).
const COMBO_OVERRIDES: Record<string, { priceEur: number; durationMin: number }> = {
  "barba+corte": { priceEur: 12.5, durationMin: 60 },
  "corte+sobrancelha": { priceEur: 12.5, durationMin: 50 },
  "barba+corte+sobrancelha": { priceEur: 15, durationMin: 75 },
}

// Display order (for "Corte + Barba" instead of "Barba + Corte")
const DISPLAY_ORDER: ServiceId[] = ["corte", "barba", "sobrancelha", "alinhamento"]

export interface Combo {
  /** Canonical alphabetical key, e.g. "barba+corte" */
  key: string
  /** Display name, e.g. "Corte + Barba" */
  name: string
  /** Item ids in canonical (alphabetical) order */
  itemIds: ServiceId[]
  priceEur: number
  durationMin: number
}

export function getServiceItem(id: string): ServiceItem | undefined {
  return SERVICES.find((s) => s.id === id)
}

export function validateSelection(
  itemIds: readonly string[],
): { ok: true } | { ok: false; error: string } {
  if (itemIds.length === 0) {
    return { ok: false, error: "Escolhe pelo menos um serviço." }
  }
  const set = new Set(itemIds)
  for (const id of set) {
    if (!getServiceItem(id)) return { ok: false, error: `Serviço desconhecido: ${id}` }
  }
  if (set.has("corte") && set.has("alinhamento")) {
    return {
      ok: false,
      error:
        "O alinhamento já está incluído no corte. Escolhe um ou outro, não ambos.",
    }
  }
  return { ok: true }
}

/** Build a Combo from selected item ids. Throws if invalid — call validateSelection first. */
export function buildCombo(itemIds: readonly string[]): Combo {
  const v = validateSelection(itemIds)
  if (!v.ok) throw new Error(v.error)

  const unique = [...new Set(itemIds)] as ServiceId[]
  const sortedKey = [...unique].sort()
  const key = sortedKey.join("+")

  const override = COMBO_OVERRIDES[key]
  const items = sortedKey.map((id) => getServiceItem(id)!)

  const priceEur = override
    ? override.priceEur
    : items.reduce((sum, s) => sum + s.priceEur, 0)
  const durationMin = override
    ? override.durationMin
    : items.reduce((sum, s) => sum + s.durationMin, 0)

  return {
    key,
    name: makeDisplayName(unique),
    itemIds: sortDisplay(unique),
    priceEur,
    durationMin,
  }
}

function sortDisplay(ids: ServiceId[]): ServiceId[] {
  return [...ids].sort(
    (a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b),
  )
}

function makeDisplayName(ids: ServiceId[]): string {
  const sorted = sortDisplay(ids)
  return sorted.map((id) => getServiceItem(id)!.name).join(" + ")
}

export function formatPrice(priceEur: number): string {
  return priceEur.toFixed(2).replace(".", ",") + " €"
}

/**
 * Marginal cost of adding `candidateId` to the current selection.
 *
 * Used by the services UI to show a discounted addon price (e.g., "Barba 5€"
 * becomes "2,50€" after the customer picks "Corte"). Returns the listed
 * price unchanged when the candidate is already selected, when adding it
 * would create an invalid combo, or when the resulting combo has no discount.
 */
export function marginalPrice(
  currentIds: readonly ServiceId[],
  candidateId: ServiceId,
): number {
  const candidate = getServiceItem(candidateId)
  if (!candidate) return 0

  const current = [...currentIds].filter((id) => id !== candidateId)
  if (current.length === 0) return candidate.priceEur

  const next = [...current, candidateId]
  if (!validateSelection(next).ok) return candidate.priceEur

  const currentCombo = buildCombo(current)
  const nextCombo = buildCombo(next)
  return nextCombo.priceEur - currentCombo.priceEur
}

/** Parse comma-separated services from a query param, e.g. "corte,barba" */
export function parseServicesParam(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}
