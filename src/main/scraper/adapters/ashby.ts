import type { EmploymentType } from '@shared/types'
import { fetchText } from '../render'
import { htmlToText } from '../htmltext'
import { titleCaseSlug, type Adapter } from './types'

function mapEmployment(v: unknown): EmploymentType | null {
  const s = String(v ?? '').toLowerCase()
  if (s.includes('fulltime') || s === 'full-time') return 'full-time'
  if (s.includes('parttime') || s === 'part-time') return 'part-time'
  if (s.includes('contract')) return 'contract'
  if (s.includes('intern')) return 'internship'
  if (s.includes('temp')) return 'temporary'
  return null
}

export const ashby: Adapter = {
  id: 'ashby',
  match: (url) => /(^|\.)ashbyhq\.com$/.test(url.hostname),
  run: async (url) => {
    // jobs.ashbyhq.com/<org>/<uuid>
    const m = url.pathname.match(/^\/([^/]+)\/([0-9a-f-]{20,})/i)
    if (!m) return null
    const org = m[1]
    const jobId = m[2]

    const res = await fetchText(
      `https://api.ashbyhq.com/posting-api/job-board/${org}?includeCompensation=true`,
    )
    if (!res.ok) return null

    let data: Record<string, unknown>
    try {
      data = JSON.parse(res.body)
    } catch {
      return null
    }

    const jobs = Array.isArray(data.jobs) ? (data.jobs as Record<string, unknown>[]) : []
    const job = jobs.find((j) => String(j.id) === jobId || String(j.jobId) === jobId)
    if (!job) return null

    const jdText = htmlToText(
      String(job.descriptionHtml ?? '') || String(job.descriptionPlain ?? ''),
    )
    if (jdText.length < 80) return null

    const company =
      (typeof data.organizationName === 'string' && data.organizationName) ||
      (typeof data.name === 'string' && data.name) ||
      titleCaseSlug(org)

    const publishedAt =
      typeof job.publishedAt === 'string' ? job.publishedAt.slice(0, 10) : null

    return {
      sourceSite: 'ashby',
      company,
      roleTitle: typeof job.title === 'string' ? job.title.trim() : null,
      location: typeof job.location === 'string' ? job.location : null,
      employmentType: mapEmployment(job.employmentType),
      workplaceType: job.isRemote === true ? 'remote' : null,
      datePosted: publishedAt,
      jdText,
    }
  },
}
