import type { WorkplaceType } from '@shared/types'
import { fetchText } from '../render'
import { htmlToText } from '../htmltext'
import { titleCaseSlug, type Adapter } from './types'

function mapRemote(v: unknown): WorkplaceType | null {
  const s = String(v ?? '').toLowerCase()
  if (s.includes('remote')) return 'remote'
  if (s.includes('hybrid')) return 'hybrid'
  if (s.includes('office') || s.includes('on-site') || s.includes('onsite')) return 'onsite'
  return null
}

export const workday: Adapter = {
  id: 'workday',
  match: (url) => /\.myworkdayjobs\.com$/.test(url.hostname),
  run: async (url) => {
    // https://<tenant>.<dc>.myworkdayjobs.com/[<lang>/]<site>/job/<loc>/<Title>_<jobId>[/apply...]
    const tenant = url.hostname.split('.')[0]
    const segs = url.pathname.split('/').filter(Boolean)
    const jobIdx = segs.indexOf('job')
    if (jobIdx < 1) return null
    // site is the segment right before "job"; anything earlier (a lang code) is ignored
    const site = segs[jobIdx - 1]
    const tail = segs.slice(jobIdx).join('/') // job/<loc>/<Title>_<id>
    const cxs = `https://${url.hostname}/wday/cxs/${tenant}/${site}/${tail}`

    const res = await fetchText(cxs, { Accept: 'application/json' })
    if (!res.ok) return null

    let data: Record<string, unknown>
    try {
      data = JSON.parse(res.body)
    } catch {
      return null
    }

    const info = (data.jobPostingInfo ?? {}) as Record<string, unknown>
    const jdText = htmlToText(String(info.jobDescription ?? ''))
    if (jdText.length < 80) return null

    const org = (data.hiringOrganization ?? {}) as Record<string, unknown>
    const company =
      (typeof org.name === 'string' && org.name.trim()) || titleCaseSlug(tenant)

    const startDate =
      typeof info.startDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(info.startDate)
        ? info.startDate.slice(0, 10)
        : null

    return {
      sourceSite: 'workday',
      company,
      roleTitle: typeof info.title === 'string' ? info.title.trim() : null,
      location: typeof info.location === 'string' ? info.location : null,
      workplaceType: mapRemote(info.remoteType),
      datePosted: startDate,
      jdText,
    }
  },
}
