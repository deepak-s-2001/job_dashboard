import { describe, expect, it } from 'vitest'
import { parseTable } from './csv'

describe('parseTable', () => {
  it('parses a simple comma CSV with a header row', () => {
    const t = parseTable('Company,Role\nAcme,Engineer\nNorthwind,Designer')
    expect(t.headers).toEqual(['Company', 'Role'])
    expect(t.rows).toEqual([
      ['Acme', 'Engineer'],
      ['Northwind', 'Designer'],
    ])
  })

  it('detects tab delimiter and trims fields', () => {
    const t = parseTable('Company\tRole\n Acme \t Engineer ')
    expect(t.headers).toEqual(['Company', 'Role'])
    expect(t.rows).toEqual([['Acme', 'Engineer']])
  })

  it('honours quoted fields with commas and escaped quotes', () => {
    const t = parseTable('Company,Note\n"Acme, Inc.","She said ""hi"" today"')
    expect(t.rows[0]).toEqual(['Acme, Inc.', 'She said "hi" today'])
  })

  it('handles quoted newlines inside a field', () => {
    const t = parseTable('Company,Note\nAcme,"line one\nline two"')
    expect(t.rows).toEqual([['Acme', 'line one\nline two']])
  })

  it('pads short rows and drops blank lines and a BOM', () => {
    const t = parseTable('﻿a,b,c\n1,2\n\n3,4,5,6')
    expect(t.headers).toEqual(['a', 'b', 'c'])
    expect(t.rows).toEqual([
      ['1', '2', ''],
      ['3', '4', '5'],
    ])
  })

  it('returns empty on empty input', () => {
    expect(parseTable('   ')).toEqual({ headers: [], rows: [] })
  })
})
