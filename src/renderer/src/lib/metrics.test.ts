import { describe, expect, it } from 'vitest'
import type { Application, ApplicationStatus, StatusEvent } from '@shared/types'
import {
  everReached,
  firstAt,
  isApplied,
  respondedAt,
  computeKpis,
  funnel,
  weeklySeries,
  bySegment,
  weekDelta,
  needsAttention,
  upcoming,
  offerTimingNudge,
} from './metrics'

let n = 0
function app(
  history: [ApplicationStatus, string][],
  over: Partial<Application> = {},
): Application {
  const statusHistory: StatusEvent[] = history.map(([status, at]) => ({ status, at }))
  const last = statusHistory[statusHistory.length - 1]
  return {
    id: `a${n++}`,
    url: '',
    sourceSite: 'generic',
    company: 'Co',
    roleTitle: 'Role',
    location: null,
    workplaceType: null,
    employmentType: null,
    datePosted: null,
    salaryRange: null,
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: null,
    jobPostingId: null,
    jdText: '',
    dateApplied: statusHistory[0]?.at.slice(0, 10) ?? '2026-01-01',
    status: last?.status ?? 'not-applied',
    statusHistory,
    accent: 'pink',
    tags: [],
    notes: '',
    contactIds: [],
    extracted: false,
    extractionModel: null,
    extractedAt: null,
    seniority: null,
    jdSummary: '',
    responsibilities: [],
    skills: { required: [], preferred: [], industry: [] },
    companyInsights: [],
    tailoringTips: [],
    extractionRaw: null,
    interviews: [],
    offerDeadline: null,
    resumes: [],
    archivedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  }
}

describe('history readers', () => {
  const a = app([
    ['applied', '2026-01-01T12:00:00Z'],
    ['interviewing', '2026-01-10T12:00:00Z'],
    ['offer', '2026-01-20T12:00:00Z'],
  ])
  it('everReached / firstAt', () => {
    expect(everReached(a, ['interviewing'])).toBe(true)
    expect(everReached(a, ['rejected'])).toBe(false)
    expect(firstAt(a, ['interviewing', 'offer'])).toBe('2026-01-10T12:00:00Z')
  })
  it('isApplied is false for a purely saved job', () => {
    expect(isApplied(app([['not-applied', '2026-01-01T12:00:00Z']]))).toBe(false)
    expect(isApplied(a)).toBe(true)
  })
  it('a rejection counts as a response', () => {
    const r = app([
      ['applied', '2026-01-01T12:00:00Z'],
      ['rejected', '2026-01-05T12:00:00Z'],
    ])
    expect(respondedAt(r)).toBe('2026-01-05T12:00:00Z')
  })
})

describe('computeKpis', () => {
  const apps = [
    app([['not-applied', '2026-01-01T12:00:00Z']]), // saved, not counted
    app([['applied', '2026-01-01T12:00:00Z']]), // applied, no response
    app([
      ['applied', '2026-01-02T12:00:00Z'],
      ['rejected', '2026-01-06T12:00:00Z'],
    ]), // responded (rejection), no interview
    app([
      ['applied', '2026-01-03T12:00:00Z'],
      ['interviewing', '2026-01-13T12:00:00Z'],
    ]), // interviewed
    app([
      ['applied', '2026-01-04T12:00:00Z'],
      ['interviewing', '2026-01-09T12:00:00Z'],
      ['offer', '2026-01-19T12:00:00Z'],
    ]), // offer
  ]
  const k = computeKpis(apps)
  it('counts over the applied denominator', () => {
    expect(k.total).toBe(5)
    expect(k.applied).toBe(4)
    expect(k.responded).toBe(3) // rejection + interview + offer
    expect(k.interviewed).toBe(2)
    expect(k.offered).toBe(1)
    expect(k.responseRate).toBe(75) // 3/4
    expect(k.interviewRate).toBe(50) // 2/4
    expect(k.offerRate).toBe(50) // 1/2 interviewed
  })
  it('apps per interview and median days to response', () => {
    expect(k.appsPerInterview).toBe(2) // 4 / 2
    expect(k.medianDaysToResponse).toBe(5) // days: 4, 10, 15 -> median 10? recompute
  })
})

describe('funnel', () => {
  it('descends with drop-off percentages', () => {
    const apps = [
      app([['applied', '2026-01-01T12:00:00Z']]),
      app([['applied', '2026-01-01T12:00:00Z']]),
      app([['applied', '2026-01-01T12:00:00Z'], ['rejected', '2026-01-05T12:00:00Z']]),
      app([['applied', '2026-01-01T12:00:00Z'], ['interviewing', '2026-01-08T12:00:00Z']]),
    ]
    const f = funnel(apps)
    expect(f.map((s) => s.n)).toEqual([4, 2, 1, 0])
    expect(f[1].dropPct).toBe(50) // 4 -> 2
  })
})

describe('weeklySeries', () => {
  it('buckets applied and responded into the right weeks', () => {
    const today = new Date()
    const iso = (daysAgo: number) => {
      const d = new Date(today)
      d.setDate(d.getDate() - daysAgo)
      return d.toISOString().slice(0, 10)
    }
    const apps = [
      app([['applied', iso(2) + 'T12:00:00Z']]),
      app([['applied', iso(3) + 'T12:00:00Z'], ['interviewing', iso(1) + 'T12:00:00Z']]),
      app([['applied', iso(9) + 'T12:00:00Z']]),
    ]
    const s = weeklySeries(apps, 3)
    const totalApplied = s.reduce((n, w) => n + w.applied, 0)
    const totalResp = s.reduce((n, w) => n + w.responded, 0)
    expect(totalApplied).toBe(3)
    expect(totalResp).toBe(1)
    // cumulative ends at the totals
    const c = weeklySeries(apps, 3, true)
    expect(c[c.length - 1].applied).toBe(3)
  })
})

describe('bySegment', () => {
  it('groups by source and sorts by response rate', () => {
    const apps = [
      app([['applied', '2026-01-01T12:00:00Z'], ['interviewing', '2026-01-05T12:00:00Z']], { sourceSite: 'lever' }),
      app([['applied', '2026-01-01T12:00:00Z']], { sourceSite: 'greenhouse' }),
      app([['applied', '2026-01-01T12:00:00Z']], { sourceSite: 'greenhouse' }),
    ]
    const rows = bySegment(apps, (a) => [a.sourceSite])
    expect(rows[0].key).toBe('lever')
    expect(rows[0].responseRate).toBe(100)
    expect(rows[1].key).toBe('greenhouse')
    expect(rows[1].responseRate).toBe(0)
  })
})

describe('weekDelta', () => {
  it('splits this week vs last week', () => {
    const now = new Date()
    const thisWk = new Date(now)
    thisWk.setDate(thisWk.getDate() - ((thisWk.getDay() + 6) % 7)) // monday
    const lastWk = new Date(thisWk)
    lastWk.setDate(lastWk.getDate() - 3)
    const apps = [
      app([['applied', thisWk.toISOString().slice(0, 10) + 'T12:00:00Z']]),
      app([['applied', lastWk.toISOString().slice(0, 10) + 'T12:00:00Z']]),
    ]
    const d = weekDelta(apps)
    expect(d.applied.now).toBe(1)
    expect(d.applied.prev).toBe(1)
  })
})

describe('needsAttention', () => {
  const daysAgoIso = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10) + 'T12:00:00Z'
  }
  it('splits quiet (14-30d) from dead (30d+), and excludes archived', () => {
    const apps = [
      app([['applied', daysAgoIso(20)]]),
      app([['applied', daysAgoIso(40)]]),
      app([['applied', daysAgoIso(40)]], { archivedAt: '2026-01-01T00:00:00Z' }),
    ]
    const r = needsAttention(apps, [])
    expect(r.quiet).toHaveLength(1)
    expect(r.dead).toHaveLength(1) // the archived one is excluded
  })
  it('flags quiet, no-resume and no-prep', () => {
    const oldIso = daysAgoIso(20)
    const apps = [
      app([['applied', oldIso]]), // quiet + no resume
      app([['interviewing', '2026-01-01T12:00:00Z']]), // no prep + no resume
    ]
    const r = needsAttention(apps, [])
    expect(r.quiet).toHaveLength(1)
    expect(r.noResume).toHaveLength(2)
    expect(r.noPrep).toHaveLength(1)
    // an open todo for the interviewing job clears no-prep
    const r2 = needsAttention(apps, [
      {
        id: 't',
        text: 'prep',
        done: false,
        doneAt: null,
        applicationId: apps[1].id,
        dueDate: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    expect(r2.noPrep).toHaveLength(0)
  })
})

describe('upcoming', () => {
  const inDays = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString()
  }
  const iv = (at: string | null, round = 'Onsite') => ({
    id: 'i' + Math.random(),
    round,
    at,
    format: null,
    withWhom: '',
    prepNotes: '',
    outcome: 'scheduled' as const,
    createdAt: '',
    updatedAt: '',
  })

  it('merges future interviews and offer deadlines, sorted by date', () => {
    const a = app([['interviewing', '2026-01-01T12:00:00Z']], { interviews: [iv(inDays(5)), iv(inDays(1))] })
    const b = app([['offer', '2026-01-01T12:00:00Z']], {
      status: 'offer',
      offerDeadline: inDays(3).slice(0, 10),
    })
    const u = upcoming([a, b])
    expect(u.map((x) => x.kind)).toEqual(['interview', 'deadline', 'interview'])
  })

  it('drops past and cancelled interviews and archived jobs', () => {
    const past = app([['interviewing', '2026-01-01T12:00:00Z']], { interviews: [iv(inDays(-10))] })
    const cancelled = app([['interviewing', '2026-01-01T12:00:00Z']], {
      interviews: [{ ...iv(inDays(2)), outcome: 'cancelled' as const }],
    })
    const arch = app([['interviewing', '2026-01-01T12:00:00Z']], {
      interviews: [iv(inDays(2))],
      archivedAt: '2026-01-01T00:00:00Z',
    })
    expect(upcoming([past, cancelled, arch])).toEqual([])
  })
})

describe('offerTimingNudge', () => {
  const inDays = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }
  it('fires only with a near deadline AND another live interviewing process', () => {
    const offer = app([['offer', '2026-01-01T12:00:00Z']], { status: 'offer', offerDeadline: inDays(4) })
    const other = app([['interviewing', '2026-01-01T12:00:00Z']])
    expect(offerTimingNudge([offer, other])).toContain('due soon')
    expect(offerTimingNudge([offer])).toBeNull() // no other process
    const farOffer = app([['offer', '2026-01-01T12:00:00Z']], { status: 'offer', offerDeadline: inDays(30) })
    expect(offerTimingNudge([farOffer, other])).toBeNull() // deadline not near
  })
})
