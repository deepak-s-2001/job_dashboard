import { fetchText, renderPage } from '../render'
import { htmlToText } from '../htmltext'
import { parseJobPostingLd } from '../jsonld'
import type { Adapter } from './types'

function jobId(url: URL): string | null {
  // /jobs/view/<slug>-<id> or /jobs/view/<id>
  const m = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/)
  if (m) return m[1]
  const q = url.searchParams.get('currentJobId') || url.searchParams.get('refId')
  if (q && /^\d{6,}$/.test(q)) return q
  const m2 = url.pathname.match(/(\d{9,})/)
  return m2 ? m2[1] : null
}

function pick(html: string, re: RegExp): string | null {
  const m = html.match(re)
  return m ? htmlToText(m[1]).trim() || null : null
}

export const linkedin: Adapter = {
  id: 'linkedin',
  match: (url) => /(^|\.)linkedin\.com$/.test(url.hostname) && /\/jobs\//.test(url.pathname + url.search),
  run: async (url) => {
    const id = jobId(url)
    if (!id) return null

    const res = await fetchText(
      `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`,
      { Accept: 'text/html' },
    )

    if (res.ok && res.body.length > 400) {
      const html = res.body

      // The guest fragment often embeds JSON-LD.
      const ldBlocks: unknown[] = []
      for (const m of html.matchAll(
        /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      )) {
        try {
          ldBlocks.push(JSON.parse(m[1]))
        } catch {
          /* ignore */
        }
      }
      const ld = parseJobPostingLd(ldBlocks)

      const title =
        ld?.title ??
        pick(html, /<h2[^>]*top-card-layout__title[^>]*>([\s\S]*?)<\/h2>/i) ??
        pick(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
      const company =
        ld?.company ??
        pick(html, /topcard__org-name-link[^>]*>([\s\S]*?)<\/a>/i) ??
        pick(html, /<span[^>]*topcard__flavor[^>]*>([\s\S]*?)<\/span>/i)
      const location = pick(
        html,
        /<span[^>]*(?:topcard__flavor--bullet|job-details-jobs-unified-top-card__bullet)[^>]*>([\s\S]*?)<\/span>/i,
      )
      const descHtml =
        html.match(
          /<div[^>]*(?:description__text|show-more-less-html__markup)[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
        )?.[1] ?? ''
      const jdText = ld?.description ?? htmlToText(descHtml)

      if (jdText && jdText.length > 120) {
        return {
          sourceSite: 'linkedin',
          company: company ?? null,
          roleTitle: title ?? null,
          location: ld?.location ?? location ?? null,
          employmentType: ld?.employmentType ?? null,
          datePosted: ld?.datePosted ?? null,
          salaryRange: ld?.salaryRange ?? null,
          jdText,
        }
      }
    }

    // Guest endpoint blocked / thin — try the full page on the logged-in session.
    try {
      const page = await renderPage(url.toString())
      const ld = parseJobPostingLd(page.jsonLd)
      const jdText = ld?.description ?? page.text
      if (jdText && jdText.length > 200) {
        return {
          sourceSite: 'linkedin',
          company: ld?.company ?? page.meta['og:title']?.split(' hiring ')?.[0] ?? null,
          roleTitle: ld?.title ?? null,
          location: ld?.location ?? null,
          employmentType: ld?.employmentType ?? null,
          datePosted: ld?.datePosted ?? null,
          salaryRange: ld?.salaryRange ?? null,
          jdText,
        }
      }
    } catch {
      /* fall through to orchestrator */
    }
    return null
  },
}
