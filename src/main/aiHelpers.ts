/** Coercion helpers shared by every schema-locked Anthropic tool-call parser
 * (extract.ts, tailoredResume.ts) — never trust a raw tool-use payload's
 * shape, even under `strict: true`, without passing it through one of these. */

export function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean)
}

export function asStrOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

export function asNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}
