export const CHART = {
  applied: '#6c8cff',
  responded: '#ff6b57',
  bar: '#23a094',
  ink: '#141414',
  grid: 'rgba(20,20,20,0.14)',
} as const

/** A round "nice" upper bound for an axis: 1/2/5 × 10^k just above `max`. */
export function niceMax(max: number): number {
  if (max <= 1) return 1
  const pow = 10 ** Math.floor(Math.log10(max))
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * pow >= max) return step * pow
  }
  return 10 * pow
}

export interface Scale {
  (v: number): number
}

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0 || 1
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0)
}

export function ticks(max: number, count = 4): number[] {
  const step = niceMax(max / count)
  const out: number[] = []
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}
