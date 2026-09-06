import type { EmploymentType, WorkplaceType } from '@shared/types'
import { fetchText } from '../render'
import { htmlToText } from '../htmltext'
import { titleCaseSlug, type Adapter } from './types'

function ids(url: URL): { org: string; postingId: string } | null {
  // jobs.lever.co/<org>/<uuid>
  const m = url.pathname.match(/^\/([^/]+)\/([0-9a-f-]{16,})/i)
  if (!m) return null
  return { org: m[1], postingId: m[2] }
}

function mapCommitment(v: unknown): EmploymentType | null {
  const s = String(v ?? '').toLowerCase()
  if (s.includes('full')) return 'full-time'
  if (s.includes('part')) return 'part-time'
  if (s.includes('contract')) return 'contract'
  if (s.includes('intern')) return 'internship'
  if (s.includes('temp')) return 'temporary'
  return null
}

function mapWorkplace(v: unknown): WorkplaceType | null {
  const s = String(v ?? '').toLowerCase()
  if (s === 'remote') return 'remote'
  if (s === 'hybrid') return 'hybrid'
  if (s === 'on-site' || s === 'onsite') return 'onsite'
  return null
}

export const lever: Adapter = {
  id: 'lever',
  match: (url) => /(^|\.)lever\.co$/.test(url.hostname),
  run: async (url) => {
    const parsed = ids(url)
    if (!parsed) return null
    const { org, postingId } = parsed

    const res = await fetchText(`https://api.lever.co/v0/postings/${org}/${postingId}`)
    if (!res.ok) return null

    let p: Record<string, unknown>
    try {
      p = JSON.parse(res.body)
    } catch {
      return null
    }

    const cats = (p.categories ?? {}) as Record<string, unknown>
    const listsText = Array.isArray(p.lists)
      ? (p.lists as Record<string, unknown>[])
          .map((l) => `${String(l.text ?? '')}\n${htmlToText(String(l.content ?? ''))}`)
          .join('\n\n')
      : ''
    const jdText = [
      htmlToText(String(p.description ?? '')),
      listsText,
      htmlToText(String(p.additional ?? '')),
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim()

    if (jdText.length < 80) return null

    const createdAt =
      typeof p.createdAt === 'number' ? new Date(p.createdAt).toISOString().slice(0, 10) : null

    return {
      sourceSite: 'lever',
      company: titleCaseSlug(org),
      roleTitle: typeof p.text === 'string' ? p.text.trim() : null,
      location: typeof cats.location === 'string' ? cats.location : null,
      employmentType: mapCommitment(cats.commitment),
      workplaceType: mapWorkplace(p.workplaceType),
      datePosted: createdAt,
      jdText,
    }
  },
}
