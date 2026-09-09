import type { Application, Contact } from '@shared/types'

const SUFFIXES = new Set([
  'inc',
  'incorporated',
  'llc',
  'llp',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
  'plc',
  'gmbh',
  'ag',
  'sa',
  'nv',
  'bv',
  'oy',
  'ab',
  'pty',
  'group',
  'holdings',
  'technologies',
  'technology',
  'labs',
  'solutions',
])

/** Loose, deterministic company-name key for matching a contact to a job. */
export function normalizeCompany(raw: string): string {
  const words = (raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[.,/#!$%^*;:{}=\-_`~()'"|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .split(' ')
    .filter((w) => w && !SUFFIXES.has(w))
  return words.join(' ')
}

export function companyMatches(a: string, b: string): boolean {
  const na = normalizeCompany(a)
  const nb = normalizeCompany(b)
  return na.length > 0 && na === nb
}

export interface JobNetwork {
  /** contacts whose company matches this job's company (derived, not stored) */
  matched: Contact[]
  /** contacts manually linked via app.contactIds, excluding any already in `matched` */
  linked: Contact[]
}

export function contactsForJob(contacts: Contact[], app: Application): JobNetwork {
  const linkedIds = new Set(app.contactIds ?? [])
  const matched = contacts.filter((c) => !linkedIds.has(c.id) && companyMatches(c.company, app.company))
  const matchedIds = new Set(matched.map((c) => c.id))
  const byId = new Map(contacts.map((c) => [c.id, c]))
  const linked = (app.contactIds ?? [])
    .map((id) => byId.get(id))
    .filter((c): c is Contact => !!c && !matchedIds.has(c.id))
  return { matched, linked }
}

/** How many jobs a contact is connected to (auto-match or manual link). */
export function jobsForContact(apps: Application[], contact: Contact): Application[] {
  return apps.filter(
    (a) => (a.contactIds ?? []).includes(contact.id) || companyMatches(contact.company, a.company),
  )
}
