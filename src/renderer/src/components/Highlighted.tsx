import type { ReactNode } from 'react'

/**
 * Renders a string with highlighter emphasis:
 *  - `==phrase==` or `**phrase**` from the model → highlighted
 *  - if the string carries no markers, "quoted phrases" and figures like
 *    `40%`, `3x`, `5+ years` get a lighter auto-highlight so a bullet is never flat.
 */
export function Highlighted({ text, tone = 'yellow' }: { text: string; tone?: 'yellow' | 'pink' }) {
  return <>{render(text, tone)}</>
}

/** Plain text with markers stripped — for "copy all". */
export function stripMarkers(text: string): string {
  return text.replace(/==([^=]+)==/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
}

function mark(node: ReactNode, key: number, tone: 'yellow' | 'pink'): ReactNode {
  return (
    <mark key={key} className={tone === 'pink' ? 'hl hl-pink' : 'hl'}>
      {node}
    </mark>
  )
}

function render(text: string, tone: 'yellow' | 'pink'): ReactNode[] {
  const explicit = /==[^=]+==|\*\*[^*]+\*\*/
  const re = explicit.test(text)
    ? /(==([^=]+)==|\*\*([^*]+)\*\*)/g
    : /("[^"]{2,}"|\b\d[\d.,]*\s?(?:%|x|\+\s?years?|k\b|K\b))/g

  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const inner = m[2] ?? m[3] ?? m[0]
    out.push(mark(inner, key++, tone))
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
