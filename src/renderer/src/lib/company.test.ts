import { describe, expect, it } from 'vitest'
import type { Application, Contact } from '@shared/types'
import { normalizeCompany, companyMatches, contactsForJob } from './company'

describe('normalizeCompany', () => {
  it('strips legal suffixes, punctuation, a leading "the", and case', () => {
    expect(normalizeCompany('The Acme Robotics, Inc.')).toBe('acme robotics')
    expect(normalizeCompany('ACME  ROBOTICS LLC')).toBe('acme robotics')
  })
  it('expands & to "and"', () => {
    expect(normalizeCompany('Ben & Jerry')).toBe('ben and jerry')
  })
  it('is empty for junk-only input', () => {
    expect(normalizeCompany('  ,. ')).toBe('')
  })
})

describe('companyMatches', () => {
  it('matches across suffix/punctuation/case differences', () => {
    expect(companyMatches('Bank of America', 'BANK OF AMERICA CORP.')).toBe(true)
  })
  it('does not match different companies', () => {
    expect(companyMatches('Acme', 'Northwind')).toBe(false)
  })
  it('does not match two empties', () => {
    expect(companyMatches('', '')).toBe(false)
  })
})

const contact = (over: Partial<Contact>): Contact => ({
  id: 'c1',
  name: 'Pat',
  email: '',
  company: '',
  title: '',
  relationship: 'other',
  linkedinUrl: '',
  links: [],
  howYouKnow: '',
  notes: '',
  createdAt: '',
  updatedAt: '',
  ...over,
})

const app = (over: Partial<Application>): Application =>
  ({ id: 'j1', company: '', contactIds: [], ...over }) as Application

describe('contactsForJob', () => {
  it('auto-matches a contact by company and keeps manual links separate', () => {
    const contacts = [
      contact({ id: 'a', company: 'Acme Inc' }),
      contact({ id: 'b', company: 'Northwind' }),
      contact({ id: 'c', company: 'Somewhere else' }),
    ]
    const res = contactsForJob(contacts, app({ company: 'ACME', contactIds: ['c'] }))
    expect(res.matched.map((c) => c.id)).toEqual(['a'])
    expect(res.linked.map((c) => c.id)).toEqual(['c'])
  })

  it('an explicit link wins: a company-matched contact shows once, as linked', () => {
    const contacts = [contact({ id: 'a', company: 'Acme' })]
    const res = contactsForJob(contacts, app({ company: 'Acme', contactIds: ['a'] }))
    expect(res.matched).toEqual([])
    expect(res.linked.map((c) => c.id)).toEqual(['a'])
  })
})
