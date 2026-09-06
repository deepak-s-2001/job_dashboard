import type { ScrapedJob } from '@shared/types'

export type AdapterResult = Partial<ScrapedJob> & { jdText: string }

export interface Adapter {
  id: ScrapedJob['sourceSite']
  /** does this adapter recognize the URL? */
  match: (url: URL) => boolean
  /** try the adapter's fast path; return null to fall back to full render */
  run: (url: URL) => Promise<AdapterResult | null>
}

export function titleCaseSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
