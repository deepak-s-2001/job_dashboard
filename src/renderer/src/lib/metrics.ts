import type { Application, ApplicationStatus, Todo } from '@shared/types'

const DAY = 86_400_000

// ---------- status-history readers ----------

const RESPONDED = ['interviewing', 'offer', 'rejected'] as const
const INTERVIEWED = ['interviewing', 'offer'] as const

export function everReached(app: Application, statuses: readonly ApplicationStatus[]): boolean {
  const set = new Set<string>(statuses)
  return (app.statusHistory ?? []).some((h) => set.has(h.status))
}

/** Earliest `at` among history entries matching one of `statuses`, or null. */
export function firstAt(
  app: Application,
  statuses: readonly ApplicationStatus[],
): string | null {
  const set = new Set<string>(statuses)
  let best: string | null = null
  for (const h of app.statusHistory ?? []) {
    if (set.has(h.status) && (best === null || h.at < best)) best = h.at
  }
  return best
}

export const isApplied = (a: Application): boolean =>
  (a.statusHistory ?? []).some((h) => h.status !== 'not-applied')
export const respondedAt = (a: Application): string | null => firstAt(a, RESPONDED)
export const interviewedAt = (a: Application): string | null => firstAt(a, INTERVIEWED)
export const offeredAt = (a: Application): string | null => firstAt(a, ['offer'])

const appliedAt = (a: Application): string =>
  firstAt(a, ['applied']) ??
  (a.dateApplied ? `${a.dateApplied}T12:00:00.000Z` : a.createdAt)

function median(nums: number[]): number | null {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const pct = (n: number, d: number): number => (d > 0 ? Math.round((n / d) * 100) : 0)

// ---------- KPIs ----------

export interface Kpis {
  total: number
  applied: number
  active: number
  responded: number
  interviewed: number
  offered: number
  rejected: number
  responseRate: number
  interviewRate: number
  offerRate: number
  appsPerInterview: number | null
  medianDaysToResponse: number | null
}

export function computeKpis(apps: Application[]): Kpis {
  const applied = apps.filter(isApplied)
  const responded = applied.filter((a) => respondedAt(a))
  const interviewed = applied.filter((a) => everReached(a, INTERVIEWED))
  const offered = applied.filter((a) => everReached(a, ['offer']))
  const days = responded
    .map((a) => (new Date(respondedAt(a)!).getTime() - new Date(appliedAt(a)).getTime()) / DAY)
    .filter((d) => d >= 0)
  return {
    total: apps.length,
    applied: applied.length,
    active: apps.filter((a) => a.status === 'applied' || a.status === 'interviewing').length,
    responded: responded.length,
    interviewed: interviewed.length,
    offered: offered.length,
    rejected: applied.filter((a) => everReached(a, ['rejected'])).length,
    responseRate: pct(responded.length, applied.length),
    interviewRate: pct(interviewed.length, applied.length),
    offerRate: pct(offered.length, interviewed.length),
    appsPerInterview: interviewed.length ? Math.round((applied.length / interviewed.length) * 10) / 10 : null,
    medianDaysToResponse: median(days) === null ? null : Math.round(median(days)!),
  }
}

// ---------- funnel ----------

export interface FunnelStage {
  key: string
  label: string
  n: number
  dropPct: number // % lost vs the previous stage
}

export function funnel(apps: Application[]): FunnelStage[] {
  const applied = apps.filter(isApplied)
  const counts = [
    { key: 'applied', label: 'Applied', n: applied.length },
    { key: 'responded', label: 'Responded', n: applied.filter((a) => respondedAt(a)).length },
    { key: 'interviewed', label: 'Interviewed', n: applied.filter((a) => everReached(a, INTERVIEWED)).length },
    { key: 'offered', label: 'Offered', n: applied.filter((a) => everReached(a, ['offer'])).length },
  ]
  return counts.map((c, i) => ({
    ...c,
    dropPct: i === 0 || counts[i - 1].n === 0 ? 0 : Math.round((1 - c.n / counts[i - 1].n) * 100),
  }))
}

// ---------- time series ----------

export interface WeekPoint {
  weekStart: string // 'YYYY-MM-DD' (Monday)
  applied: number
  responded: number
}

/** Monday 00:00 of the week containing `d`. */
function weekStartOf(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const isoDate = (d: Date): string => d.toISOString().slice(0, 10)

export function weeklySeries(
  apps: Application[],
  weeks = 12,
  cumulative = false,
): WeekPoint[] {
  const end = weekStartOf(new Date())
  const start = new Date(end)
  start.setDate(start.getDate() - 7 * (Math.max(1, weeks) - 1))

  const buckets: WeekPoint[] = []
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
    buckets.push({ weekStart: isoDate(d), applied: 0, responded: 0 })
  }
  const idxFor = (iso: string): number => {
    const ws = isoDate(weekStartOf(new Date(iso)))
    return buckets.findIndex((b) => b.weekStart === ws)
  }
  for (const a of apps) {
    if (!isApplied(a)) continue
    const ai = idxFor(a.dateApplied || appliedAt(a).slice(0, 10))
    if (ai >= 0) buckets[ai].applied++
    const r = respondedAt(a)
    if (r) {
      const ri = idxFor(r)
      if (ri >= 0) buckets[ri].responded++
    }
  }
  if (cumulative) {
    let ca = 0
    let cr = 0
    for (const b of buckets) {
      ca += b.applied
      cr += b.responded
      b.applied = ca
      b.responded = cr
    }
  }
  return buckets
}

// ---------- segments ----------

export interface SegmentRow {
  key: string
  applied: number
  responded: number
  interviewed: number
  responseRate: number
}

export function bySegment(apps: Application[], keysOf: (a: Application) => string[]): SegmentRow[] {
  const m = new Map<string, SegmentRow>()
  for (const a of apps) {
    if (!isApplied(a)) continue
    const resp = !!respondedAt(a)
    const intv = everReached(a, INTERVIEWED)
    for (const key of keysOf(a)) {
      if (!key) continue
      const row = m.get(key) ?? { key, applied: 0, responded: 0, interviewed: 0, responseRate: 0 }
      row.applied++
      if (resp) row.responded++
      if (intv) row.interviewed++
      m.set(key, row)
    }
  }
  return [...m.values()]
    .map((r) => ({ ...r, responseRate: pct(r.responded, r.applied) }))
    .sort((a, b) => b.responseRate - a.responseRate || b.applied - a.applied)
}

// ---------- week-over-week ----------

export interface WeekDelta {
  applied: { now: number; prev: number }
  responded: { now: number; prev: number }
  interviewed: { now: number; prev: number }
}

export function weekDelta(apps: Application[]): WeekDelta {
  const thisWeek = weekStartOf(new Date()).getTime()
  const lastWeek = thisWeek - 7 * DAY
  const inWeek = (iso: string | null, start: number): boolean => {
    if (!iso) return false
    const t = new Date(iso).getTime()
    return t >= start && t < start + 7 * DAY
  }
  const count = (pred: (a: Application) => string | null, start: number) =>
    apps.filter((a) => inWeek(pred(a), start)).length
  const appliedIso = (a: Application) =>
    isApplied(a) ? a.dateApplied ? `${a.dateApplied}T12:00:00Z` : appliedAt(a) : null
  return {
    applied: { now: count(appliedIso, thisWeek), prev: count(appliedIso, lastWeek) },
    responded: { now: count(respondedAt, thisWeek), prev: count(respondedAt, lastWeek) },
    interviewed: { now: count(interviewedAt, thisWeek), prev: count(interviewedAt, lastWeek) },
  }
}

// ---------- needs attention ----------

export interface Attention {
  quiet: Application[]
  noResume: Application[]
  noPrep: Application[]
}

export function needsAttention(apps: Application[], todos: Todo[], quietDays = 14): Attention {
  const now = Date.now()
  const openByJob = new Set(
    todos.filter((t) => !t.done && t.applicationId).map((t) => t.applicationId as string),
  )
  return {
    quiet: apps
      .filter(
        (a) =>
          a.status === 'applied' &&
          !respondedAt(a) &&
          (now - new Date(appliedAt(a)).getTime()) / DAY > quietDays,
      )
      .sort((a, b) => appliedAt(a).localeCompare(appliedAt(b))),
    noResume: apps.filter(
      (a) => (a.status === 'applied' || a.status === 'interviewing') && a.resumes.length === 0,
    ),
    noPrep: apps.filter((a) => a.status === 'interviewing' && !openByJob.has(a.id)),
  }
}

export const deltaArrow = (now: number, prev: number): string =>
  now > prev ? `▲${now - prev}` : now < prev ? `▼${prev - now}` : '—'
