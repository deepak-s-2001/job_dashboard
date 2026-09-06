// Regex-based HTML → text for API-returned description fragments (no DOM in main).

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&bull;': '•',
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&rdquo;': '”',
  '&ldquo;': '“',
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
}

export function htmlToText(html: string): string {
  if (!html) return ''
  let s = html
  s = s.replace(/<\s*(script|style|noscript|template)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
  s = s.replace(/<\s*(br)\s*\/?\s*>/gi, '\n')
  s = s.replace(/<\s*\/\s*(p|div|li|h[1-6]|tr|section|article|header|footer)\s*>/gi, '\n')
  s = s.replace(/<\s*li[^>]*>/gi, '• ')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  s = s
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s
}
