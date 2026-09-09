export interface ParsedTable {
  headers: string[]
  rows: string[][]
}

/**
 * Minimal CSV / TSV parser — enough for a pasted spreadsheet or a Huntr/Teal
 * export. Auto-detects the delimiter (tab wins if the first line has any),
 * honours `"…"` quoting with `""` escapes, and treats the first row as headers.
 */
export function parseTable(text: string): ParsedTable {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trimEnd()
  if (!src) return { headers: [], rows: [] }

  const firstLine = src.slice(0, src.indexOf('\n') === -1 ? undefined : src.indexOf('\n'))
  const delim = firstLine.includes('\t') ? '\t' : ','

  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === delim) {
      record.push(field)
      field = ''
    } else if (c === '\n') {
      record.push(field)
      records.push(record)
      field = ''
      record = []
    } else {
      field += c
    }
  }
  record.push(field)
  records.push(record)

  const nonEmpty = records.filter((r) => r.some((f) => f.trim() !== ''))
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  const headers = nonEmpty[0].map((h) => h.trim())
  const width = headers.length
  const rows = nonEmpty.slice(1).map((r) => {
    const out = r.slice(0, width).map((f) => f.trim())
    while (out.length < width) out.push('')
    return out
  })
  return { headers, rows }
}
