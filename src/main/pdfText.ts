import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Headless PDF -> plain text, for parsing an attached resume into structured
 * fields ("Parse for autofill"). Reuses the pdfjs-dist version already pinned
 * for the renderer's PDF viewer (4.10.38) — its legacy Node build supports
 * getTextContent() with no DOM/canvas/worker, which is all extraction needs.
 *
 * Text order is approximated by grouping items into lines (by Y position,
 * rounded to absorb sub-pixel jitter) and reading each line left-to-right —
 * this gets a normal single-column resume right. A genuinely multi-column
 * layout (a sidebar next to a main column) will still interleave lines from
 * both columns, since pdfjs reports text in draw order, not visual columns.
 * That's a known, accepted limit — the "Parse for autofill" UI always shows
 * an editable review before anything is saved specifically because of this.
 */

function standardFontDataUrl(): string | undefined {
  try {
    const pkg = require.resolve('pdfjs-dist/package.json')
    return join(dirname(pkg), 'standard_fonts') + '/'
  } catch {
    return undefined
  }
}

interface TextItem {
  str: string
  x: number
  y: number
}

/** Group items into lines by Y (rounded), sort each line left-to-right, lines top-to-bottom. */
function joinReadingOrder(items: TextItem[]): string {
  const lines = new Map<number, TextItem[]>()
  for (const it of items) {
    const key = Math.round(it.y / 3) * 3 // absorb a few px of jitter onto one line
    const line = lines.get(key)
    if (line) line.push(it)
    else lines.set(key, [it])
  }
  return [...lines.entries()]
    .sort((a, b) => b[0] - a[0]) // top of page first (PDF y grows upward)
    .map(([, line]) =>
      line
        .sort((a, b) => a.x - b.x)
        .map((it) => it.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .join('\n')
}

export async function extractPdfText(storedPath: string): Promise<string> {
  // pdfjs-dist 4.x ships ESM only; the main process is CJS, so this needs a
  // dynamic import rather than a top-level require.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(readFileSync(storedPath))
  const doc = await pdfjs.getDocument({
    data,
    standardFontDataUrl: standardFontDataUrl(),
  }).promise

  const pages: string[] = []
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const items: TextItem[] = content.items
        .filter((it) => 'transform' in it && 'str' in it && !!it.str.trim())
        .map((it) => {
          const item = it as { str: string; transform: number[] }
          return { str: item.str, x: item.transform[4], y: item.transform[5] }
        })
      pages.push(joinReadingOrder(items))
    }
  } finally {
    await doc.destroy()
  }
  return pages.join('\n\n').trim()
}
