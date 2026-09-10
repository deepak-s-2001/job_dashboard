import { useMemo } from 'react'
import Fuse from 'fuse.js'
import type { Application, ApplicationStatus, EmploymentType, WorkplaceType } from '@shared/types'

export type SortKey = 'applied-desc' | 'applied-asc' | 'posted-desc' | 'company-asc'

export interface Filters {
  status: ApplicationStatus[]
  employmentType: EmploymentType[]
  workplaceType: WorkplaceType[]
  sourceSite: string[]
  tags: string[]
  appliedFrom: string | null
  appliedTo: string | null
  hasResume: 'any' | 'yes' | 'no'
  extracted: 'any' | 'yes' | 'no'
  archived: 'hide' | 'only' | 'all'
}

export const EMPTY_FILTERS: Filters = {
  status: [],
  employmentType: [],
  workplaceType: [],
  sourceSite: [],
  tags: [],
  appliedFrom: null,
  appliedTo: null,
  hasResume: 'any',
  extracted: 'any',
  archived: 'hide',
}

export function filtersActive(f: Filters): number {
  return (
    f.status.length +
    f.employmentType.length +
    f.workplaceType.length +
    f.sourceSite.length +
    f.tags.length +
    (f.appliedFrom ? 1 : 0) +
    (f.appliedTo ? 1 : 0) +
    (f.hasResume !== 'any' ? 1 : 0) +
    (f.extracted !== 'any' ? 1 : 0) +
    (f.archived !== 'hide' ? 1 : 0)
  )
}

function passesFilters(a: Application, f: Filters): boolean {
  const archived = !!a.archivedAt
  if (f.archived === 'hide' && archived) return false
  if (f.archived === 'only' && !archived) return false
  if (f.status.length && !f.status.includes(a.status)) return false
  if (f.employmentType.length && !(a.employmentType && f.employmentType.includes(a.employmentType)))
    return false
  if (f.workplaceType.length && !(a.workplaceType && f.workplaceType.includes(a.workplaceType)))
    return false
  if (f.sourceSite.length && !f.sourceSite.includes(a.sourceSite)) return false
  if (f.tags.length && !f.tags.every((t) => a.tags.includes(t))) return false
  if (f.appliedFrom && a.dateApplied < f.appliedFrom) return false
  if (f.appliedTo && a.dateApplied > f.appliedTo) return false
  if (f.hasResume === 'yes' && a.resumes.length === 0) return false
  if (f.hasResume === 'no' && a.resumes.length > 0) return false
  if (f.extracted === 'yes' && !a.extracted) return false
  if (f.extracted === 'no' && a.extracted) return false
  return true
}

export function sortApps(list: Application[], key: SortKey): Application[] {
  const s = [...list]
  switch (key) {
    case 'applied-asc':
      return s.sort((a, b) => a.dateApplied.localeCompare(b.dateApplied))
    case 'posted-desc':
      return s.sort((a, b) => (b.datePosted ?? '').localeCompare(a.datePosted ?? ''))
    case 'company-asc':
      return s.sort((a, b) => a.company.localeCompare(b.company))
    case 'applied-desc':
    default:
      return s.sort(
        (a, b) =>
          b.dateApplied.localeCompare(a.dateApplied) || b.createdAt.localeCompare(a.createdAt),
      )
  }
}

export function useFilteredApps(
  apps: Application[],
  query: string,
  filters: Filters,
  sort: SortKey,
): Application[] {
  const fuse = useMemo(
    () =>
      new Fuse(apps, {
        threshold: 0.34,
        ignoreLocation: true,
        keys: [
          { name: 'company', weight: 3 },
          { name: 'roleTitle', weight: 3 },
          { name: 'tags', weight: 2 },
          { name: 'location', weight: 1 },
          { name: 'skills.required', weight: 2 },
          { name: 'skills.preferred', weight: 1 },
          { name: 'skills.industry', weight: 1 },
          { name: 'jdSummary', weight: 1 },
          { name: 'jdText', weight: 0.5 },
          { name: 'notes', weight: 1 },
        ],
      }),
    [apps],
  )

  return useMemo(() => {
    const q = query.trim()
    const base = q ? fuse.search(q).map((r) => r.item) : apps
    const filtered = base.filter((a) => passesFilters(a, filters))
    // fuse already ranks by relevance; only re-sort when there's no query
    return q ? filtered : sortApps(filtered, sort)
  }, [apps, fuse, query, filters, sort])
}
