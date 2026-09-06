import type { ScrapedJob, SourceSite } from '@shared/types'
import { findAdapter } from './adapters'
import { renderPage } from './render'
import { parseJobPostingLd } from './jsonld'

export { openLoginWindow } from './render'

const EMPTY: Omit<ScrapedJob, 'url' | 'jdText' | 'needsManualPaste' | 'note'> = {
  sourceSite: 'generic',
  company: null,
  roleTitle: null,
  location: null,
  workplaceType: null,
  employmentType: null,
  datePosted: null,
  salaryRange: null,
}

function normalizeUrl(input: string): URL {
  const trimmed = input.trim()
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return new URL(withProto)
}

function siteFromHost(url: URL): SourceSite {
  const h = url.hostname
  if (h.includes('greenhouse.io')) return 'greenhouse'
  if (h.includes('lever.co')) return 'lever'
  if (h.includes('ashbyhq.com')) return 'ashby'
  if (h.includes('myworkdayjobs.com')) return 'workday'
  if (h.includes('linkedin.com')) return 'linkedin'
  return 'generic'
}

function cleanTitle(raw: string | null): string | null {
  if (!raw) return null
  // strip common "· Company" / "| Company" / "- Job Board" tails
  return raw.split(/\s+[|·—-]\s+/)[0].trim() || raw.trim()
}

export async function scrapeUrl(rawUrl: string): Promise<ScrapedJob> {
  let url: URL
  try {
    url = normalizeUrl(rawUrl)
  } catch {
    return {
      ...EMPTY,
      url: rawUrl,
      jdText: '',
      needsManualPaste: true,
      note: "That doesn't look like a valid URL — paste the job description text instead.",
    }
  }

  // 1. dedicated adapter
  const adapter = findAdapter(url)
  if (adapter) {
    try {
      const r = await adapter.run(url)
      if (r && r.jdText && r.jdText.trim().length >= 80) {
        return {
          ...EMPTY,
          ...r,
          sourceSite: r.sourceSite ?? adapter.id,
          roleTitle: cleanTitle(r.roleTitle ?? null),
          url: url.toString(),
          jdText: r.jdText.trim(),
          needsManualPaste: false,
          note: `Read from ${adapter.id}.`,
        }
      }
    } catch {
      /* fall through to render */
    }
  }

  // 2. generic render + JSON-LD + meta
  try {
    const page = await renderPage(url.toString())
    const ld = parseJobPostingLd(page.jsonLd)
    const site = siteFromHost(url)

    const jdText = (ld?.description && ld.description.length > 200 ? ld.description : page.text) ?? ''
    const roleTitle =
      cleanTitle(ld?.title ?? null) ??
      cleanTitle(page.meta['og:title'] ?? null) ??
      cleanTitle(page.title || null)
    const company =
      ld?.company ??
      page.meta['og:site_name'] ??
      null

    const enough = jdText.trim().length >= 240
    return {
      ...EMPTY,
      url: page.finalUrl || url.toString(),
      sourceSite: site,
      company,
      roleTitle,
      location: ld?.location ?? null,
      workplaceType: ld?.workplaceType ?? null,
      employmentType: ld?.employmentType ?? null,
      datePosted: ld?.datePosted ?? null,
      salaryRange: ld?.salaryRange ?? null,
      jdText: jdText.trim(),
      needsManualPaste: !enough,
      note: ld
        ? 'Read structured job data from the page.'
        : enough
          ? 'Pulled the main text from the page — double-check the fields.'
          : 'Could not get a clean read of this page. Paste the job description text below.',
    }
  } catch (err) {
    return {
      ...EMPTY,
      url: url.toString(),
      sourceSite: siteFromHost(url),
      jdText: '',
      needsManualPaste: true,
      note: `Could not load the page (${
        err instanceof Error ? err.message : 'unknown error'
      }). Paste the job description text below.`,
    }
  }
}

/** Manual-paste path: user supplies the JD text (and optionally company/role). */
export function scrapeFromText(rawUrl: string, pastedText: string): ScrapedJob {
  let site: SourceSite = 'generic'
  let urlOut = rawUrl.trim()
  try {
    const url = normalizeUrl(rawUrl)
    site = siteFromHost(url)
    urlOut = url.toString()
  } catch {
    /* url optional on the manual path */
  }
  const jdText = pastedText.trim()
  return {
    ...EMPTY,
    url: urlOut,
    sourceSite: site,
    jdText,
    needsManualPaste: jdText.length < 80,
    note:
      jdText.length < 80
        ? 'That is too short to be a job description.'
        : 'Using the pasted text.',
  }
}
