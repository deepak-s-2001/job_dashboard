import type { ApplicationStatus, NewApplicationInput } from '@shared/types'
import { todayIso } from './format'

/** Loose URL identity for client-side dedup — mirrors the store's normalizeUrl. */
export function normUrl(url: string): string {
  const s = (url ?? '').trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    return (u.host + u.pathname).replace(/\/+$/, '').toLowerCase()
  } catch {
    return s.replace(/^https?:\/\//i, '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase()
  }
}

export type ColTarget =
  | 'skip'
  | 'company'
  | 'role'
  | 'url'
  | 'status'
  | 'dateApplied'
  | 'location'
  | 'salary'
  | 'notes'
  | 'tags'

export const COL_TARGETS: { value: ColTarget; label: string }[] = [
  { value: 'skip', label: '— skip —' },
  { value: 'company', label: 'Company' },
  { value: 'role', label: 'Role / title' },
  { value: 'url', label: 'Job URL' },
  { value: 'status', label: 'Status' },
  { value: 'dateApplied', label: 'Date applied' },
  { value: 'location', label: 'Location' },
  { value: 'salary', label: 'Salary' },
  { value: 'notes', label: 'Notes' },
  { value: 'tags', label: 'Tags' },
]

/** Best-guess mapping from a spreadsheet / Huntr / Teal header. */
export function guessColumn(header: string): ColTarget {
  const h = header.trim().toLowerCase()
  if (/\b(company|employer|organi[sz]ation)\b/.test(h)) return 'company'
  if (/\b(role|title|position|job\s*title|job)\b/.test(h)) return 'role'
  if (/\b(url|link|posting|job\s*link)\b/.test(h)) return 'url'
  if (/\b(status|stage|pipeline)\b/.test(h)) return 'status'
  if (/date.*appl|appl.*date|applied\s*on/.test(h)) return 'dateApplied'
  if (/\b(location|city|where)\b/.test(h)) return 'location'
  if (/\b(salary|comp|compensation|pay)\b/.test(h)) return 'salary'
  if (/\b(notes?|comments?|description)\b/.test(h)) return 'notes'
  if (/\b(tags?|labels?)\b/.test(h)) return 'tags'
  return 'skip'
}

const STATUS_ALIASES: [RegExp, ApplicationStatus][] = [
  [/wish|saved|bookmark|to\s*apply|not\s*appl|lead|prospect/i, 'not-applied'],
  [/appl|submitted|pending/i, 'applied'],
  [/interview|screen|phone|onsite|assessment|technical/i, 'interviewing'],
  [/offer/i, 'offer'],
  [/reject|declin|denied|no|closed/i, 'rejected'],
  [/ghost|no\s*response|stale/i, 'ghosted'],
  [/withdr|cancel/i, 'withdrawn'],
]

export function mapStatus(raw: string): ApplicationStatus {
  const s = (raw ?? '').trim()
  if (!s) return 'not-applied'
  for (const [re, status] of STATUS_ALIASES) if (re.test(s)) return status
  return 'not-applied'
}

function toIsoDate(raw: string): string {
  const s = (raw ?? '').trim()
  if (!s) return todayIso()
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? todayIso() : d.toISOString().slice(0, 10)
}

/** Build one application payload from a parsed row + the user's column mapping. */
export function rowToInput(row: string[], mapping: ColTarget[]): NewApplicationInput | null {
  const pick = (t: ColTarget) => {
    const i = mapping.indexOf(t)
    return i === -1 ? '' : (row[i] ?? '').trim()
  }
  const company = pick('company')
  const roleTitle = pick('role')
  if (!company && !roleTitle) return null

  const url = pick('url')
  const tags = pick('tags')
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean)

  return {
    url,
    sourceSite: 'generic',
    company,
    roleTitle,
    location: pick('location') || null,
    workplaceType: null,
    employmentType: null,
    datePosted: null,
    salaryRange: pick('salary') || null,
    jdText: '',
    dateApplied: toIsoDate(pick('dateApplied')),
    status: mapStatus(pick('status')),
    tags,
    notes: pick('notes'),
    extraction: null,
  }
}
