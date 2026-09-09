import { describe, expect, it } from 'vitest'
import { guessColumn, mapStatus, normUrl, rowToInput, type ColTarget } from './import'
import { todayIso } from './format'

describe('normUrl', () => {
  it('strips protocol, query, hash and trailing slash, lowercases', () => {
    expect(normUrl('https://Boards.Greenhouse.io/acme/jobs/1/?utm=x#top')).toBe(
      'boards.greenhouse.io/acme/jobs/1',
    )
  })
  it('treats http and https the same', () => {
    expect(normUrl('http://jobs.lever.co/n/1')).toBe(normUrl('https://jobs.lever.co/n/1/'))
  })
  it('is empty for blank', () => {
    expect(normUrl('  ')).toBe('')
  })
})

describe('guessColumn', () => {
  it.each<[string, ColTarget]>([
    ['Company', 'company'],
    ['Employer', 'company'],
    ['Job Title', 'role'],
    ['Position', 'role'],
    ['URL', 'url'],
    ['Link', 'url'],
    ['Status', 'status'],
    ['Stage', 'status'],
    ['Date Applied', 'dateApplied'],
    ['Location', 'location'],
    ['Salary', 'salary'],
    ['Notes', 'notes'],
    ['Tags', 'tags'],
    ['Random header', 'skip'],
  ])('%s -> %s', (h, target) => {
    expect(guessColumn(h)).toBe(target)
  })
})

describe('mapStatus', () => {
  it.each([
    ['Wishlist', 'not-applied'],
    ['Saved', 'not-applied'],
    ['Applied', 'applied'],
    ['Interviewing', 'interviewing'],
    ['Phone Screen', 'interviewing'],
    ['Offer', 'offer'],
    ['Rejected', 'rejected'],
    ['Declined', 'rejected'],
    ['Ghosted', 'ghosted'],
    ['Withdrawn', 'withdrawn'],
    ['', 'not-applied'],
    ['something weird', 'not-applied'],
  ])('%s -> %s', (raw, want) => {
    expect(mapStatus(raw)).toBe(want)
  })
})

describe('rowToInput', () => {
  const mapping: ColTarget[] = ['company', 'role', 'url', 'status', 'dateApplied', 'tags']

  it('builds a NewApplicationInput from a mapped row', () => {
    const out = rowToInput(
      ['Acme', 'Senior DSP Engineer', 'https://x.co/1', 'Interviewing', '2026-09-01', 'dream; referral'],
      mapping,
    )
    expect(out).toMatchObject({
      company: 'Acme',
      roleTitle: 'Senior DSP Engineer',
      url: 'https://x.co/1',
      status: 'interviewing',
      dateApplied: '2026-09-01',
      tags: ['dream', 'referral'],
      sourceSite: 'generic',
      extraction: null,
    })
  })

  it('returns null when both company and role are blank', () => {
    expect(rowToInput(['', '', 'https://x.co/1'], mapping)).toBeNull()
  })

  it('falls back to today for a missing/invalid date', () => {
    const out = rowToInput(['Acme', 'Eng', '', '', 'not a date', ''], mapping)
    expect(out?.dateApplied).toBe(todayIso())
  })
})
