import type { SalaryPeriod } from './types'

export interface SalaryParts {
  min: number | null
  max: number | null
  period: SalaryPeriod | null
}

const NUM = /(\d[\d,]*\.?\d*)\s*([kKmM])?/g

/** Best-effort parse of a free-text pay string into a numeric range. */
export function parseSalary(raw: string | null | undefined): SalaryParts {
  const s = (raw ?? '').trim()
  if (!s) return { min: null, max: null, period: null }

  const lower = s.toLowerCase()
  const hourly = /\/\s*h|per\s*hour|hourly|an hour|\bhr\b/.test(lower)

  const nums: number[] = []
  let m: RegExpExecArray | null
  NUM.lastIndex = 0
  while ((m = NUM.exec(s)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ''))
    if (!Number.isFinite(n)) continue
    const suf = (m[2] ?? '').toLowerCase()
    if (suf === 'k') n *= 1_000
    else if (suf === 'm') n *= 1_000_000
    nums.push(n)
  }
  if (nums.length === 0) return { min: null, max: null, period: null }

  let period: SalaryPeriod | null = hourly ? 'hour' : null
  if (!period) {
    // heuristic: small bare numbers are hourly, large ones annual
    period = nums.every((n) => n < 400) ? 'hour' : 'year'
  }

  const sorted = [...nums].sort((a, b) => a - b)
  return {
    min: sorted[0] ?? null,
    max: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    period,
  }
}

function abbr(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`
  return `$${n.toLocaleString()}`
}

/** Render a numeric range; falls back to `raw` when there's nothing structured. */
export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  period: SalaryPeriod | null | undefined,
  raw?: string | null,
): string {
  const suffix = period === 'hour' ? '/hr' : period === 'year' ? '/yr' : ''
  if (min != null && max != null) return `${abbr(min)}–${abbr(max)}${suffix}`
  if (min != null) return `${abbr(min)}+${suffix}`
  if (max != null) return `up to ${abbr(max)}${suffix}`
  return (raw ?? '').trim()
}
