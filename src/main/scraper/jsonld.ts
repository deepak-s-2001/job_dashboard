import type { EmploymentType, WorkplaceType } from '@shared/types'
import { htmlToText } from './htmltext'

export interface JobPostingLd {
  title: string | null
  company: string | null
  location: string | null
  workplaceType: WorkplaceType | null
  employmentType: EmploymentType | null
  datePosted: string | null
  validThrough: string | null
  salaryRange: string | null
  description: string | null
}

function flatten(node: unknown, out: Record<string, unknown>[]): void {
  if (!node) return
  if (Array.isArray(node)) {
    for (const n of node) flatten(n, out)
    return
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>
    if ('@graph' in obj) flatten(obj['@graph'], out)
    out.push(obj)
  }
}

function typeMatches(t: unknown): boolean {
  if (typeof t === 'string') return t.toLowerCase() === 'jobposting'
  if (Array.isArray(t)) return t.some((x) => String(x).toLowerCase() === 'jobposting')
  return false
}

function mapEmployment(v: unknown): EmploymentType | null {
  const s = String(Array.isArray(v) ? v[0] : v || '').toUpperCase()
  if (s.includes('FULL')) return 'full-time'
  if (s.includes('PART')) return 'part-time'
  if (s.includes('CONTRACT') || s.includes('CONTRACTOR')) return 'contract'
  if (s.includes('INTERN')) return 'internship'
  if (s.includes('TEMP')) return 'temporary'
  return null
}

function mapWorkplace(obj: Record<string, unknown>): WorkplaceType | null {
  const lt = obj['jobLocationType']
  if (typeof lt === 'string' && lt.toUpperCase().includes('TELECOMMUTE')) return 'remote'
  return null
}

function extractLocation(obj: Record<string, unknown>): string | null {
  const loc = obj['jobLocation']
  const first = Array.isArray(loc) ? loc[0] : loc
  if (!first || typeof first !== 'object') return null
  const addr = (first as Record<string, unknown>)['address']
  if (!addr || typeof addr !== 'object') return null
  const a = addr as Record<string, unknown>
  const parts = [a['addressLocality'], a['addressRegion'], a['addressCountry']]
    .map((p) => (typeof p === 'object' && p ? (p as Record<string, unknown>)['name'] : p))
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
  return parts.length ? parts.join(', ') : null
}

function extractSalary(obj: Record<string, unknown>): string | null {
  const bs = obj['baseSalary']
  if (!bs || typeof bs !== 'object') return null
  const value = (bs as Record<string, unknown>)['value']
  const currency = (bs as Record<string, unknown>)['currency'] ?? 'USD'
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const unit = String(v['unitText'] ?? '').toLowerCase()
  const min = v['minValue']
  const max = v['maxValue']
  const single = v['value']
  const fmt = (n: unknown) => Number(n).toLocaleString('en-US')
  const suffix = unit ? ` / ${unit}` : ''
  if (min != null && max != null) return `${currency} ${fmt(min)}–${fmt(max)}${suffix}`
  if (single != null) return `${currency} ${fmt(single)}${suffix}`
  return null
}

function companyName(obj: Record<string, unknown>): string | null {
  const org = obj['hiringOrganization']
  if (typeof org === 'string') return org
  if (org && typeof org === 'object') {
    const n = (org as Record<string, unknown>)['name']
    if (typeof n === 'string') return n
  }
  return null
}

export function parseJobPostingLd(blocks: unknown[]): JobPostingLd | null {
  const flat: Record<string, unknown>[] = []
  for (const b of blocks) flatten(b, flat)
  const posting = flat.find((o) => typeMatches(o['@type']))
  if (!posting) return null

  const descRaw = typeof posting['description'] === 'string' ? (posting['description'] as string) : null

  return {
    title: typeof posting['title'] === 'string' ? (posting['title'] as string).trim() : null,
    company: companyName(posting),
    location: extractLocation(posting),
    workplaceType: mapWorkplace(posting),
    employmentType: mapEmployment(posting['employmentType']),
    datePosted:
      typeof posting['datePosted'] === 'string'
        ? (posting['datePosted'] as string).slice(0, 10)
        : null,
    validThrough:
      typeof posting['validThrough'] === 'string'
        ? (posting['validThrough'] as string).slice(0, 10)
        : null,
    salaryRange: extractSalary(posting),
    description: descRaw ? htmlToText(descRaw) : null,
  }
}
