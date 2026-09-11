import type { ScrapedJob, SourceSite } from '@shared/types'
import { parseSalary } from '@shared/salary'
import { findAdapter } from './adapters'
import { renderPage } from './render'
import { parseJobPostingLd } from './jsonld'
import { htmlToText } from './htmltext'

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
  salaryMin: null,
  salaryMax: null,
  salaryPeriod: null,
  jobPostingId: null,
}

/** fill the numeric salary fields from whatever raw string we scraped */
function withSalary(job: ScrapedJob): ScrapedJob {
  const p = parseSalary(job.salaryRange)
  return { ...job, salaryMin: p.min, salaryMax: p.max, salaryPeriod: p.period }
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

// \b so "pay" doesn't match inside "paid"/"payroll" — a real job page repeats
// "pay"/"compensation" many times (benefits boilerplate, EEO statements), so
// this has to try every occurrence, not just the first.
const PAY_KEYWORD_RE = /\b(pay|salary|compensation)\b\s*(range)?/gi
const PAY_NUMBERS_RE =
  /\$?[\d,]{4,7}(?:\.\d+)?\s*(?:usd)?\s*(?:-|–|—|to)\s*\$?[\d,]{4,7}(?:\.\d+)?\s*(?:usd)?(?:\s*(?:per\s*(?:year|hour|annum)|\/\s*(?:yr|hr)))?/i

/**
 * Many enterprise ATS templates (Phenom People and similar) render a pay-range
 * disclosure as its own page section, separate from the JobPosting JSON-LD
 * `description` and outside whatever "main content" container the generic
 * scrape biases toward — so it can be entirely absent from `jdText` even
 * though it's plainly visible on the page. Search the FULL page text (all of
 * it, via htmlToText on the raw HTML — not the main-content-biased `page.text`)
 * for a pay keyword followed within a short window by a number range — trying
 * every keyword occurrence, since most of them (benefits boilerplate, EEO
 * statements) won't have numbers nearby and aren't the actual disclosure.
 */
function findPayRangeSnippet(fullPageText: string): string | null {
  PAY_KEYWORD_RE.lastIndex = 0
  let kw: RegExpExecArray | null
  while ((kw = PAY_KEYWORD_RE.exec(fullPageText)) !== null) {
    const window = fullPageText.slice(kw.index, kw.index + 200)
    const nums = PAY_NUMBERS_RE.exec(window)
    if (nums) return `${kw[0].trim()}: ${nums[0].trim()}`
  }
  return null
}

export async function scrapeUrl(rawUrl: string): Promise<ScrapedJob> {
  return withSalary(await scrapeUrlImpl(rawUrl))
}

async function scrapeUrlImpl(rawUrl: string): Promise<ScrapedJob> {
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

    let jdText = (ld?.description && ld.description.length > 200 ? ld.description : page.text) ?? ''
    const roleTitle =
      cleanTitle(ld?.title ?? null) ??
      cleanTitle(page.meta['og:title'] ?? null) ??
      cleanTitle(page.title || null)
    const company =
      ld?.company ??
      page.meta['og:site_name'] ??
      null

    // The JobPosting JSON-LD (or the main-content-biased jdText above) often
    // omits a pay-range disclosure that's plainly visible elsewhere on the
    // page — search the whole rendered page, not just what became jdText.
    let salaryRange = ld?.salaryRange ?? null
    if (!salaryRange) {
      const paySnippet = findPayRangeSnippet(htmlToText(page.html))
      if (paySnippet) {
        salaryRange = paySnippet
        if (!jdText.includes(paySnippet)) jdText = `${jdText.trim()}\n\n${paySnippet}`
      }
    }

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
      salaryRange,
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
  return withSalary(scrapeFromTextImpl(rawUrl, pastedText))
}

function scrapeFromTextImpl(rawUrl: string, pastedText: string): ScrapedJob {
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
