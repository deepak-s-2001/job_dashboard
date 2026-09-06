import { BrowserWindow } from 'electron'

export const SCRAPER_PARTITION = 'persist:scraper'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export interface RenderedPage {
  finalUrl: string
  title: string
  /** best-effort main-content text, already collapsed */
  text: string
  /** full document HTML (for JSON-LD / meta parsing) */
  html: string
  /** raw JSON-LD blocks found in the page */
  jsonLd: unknown[]
  meta: Record<string, string>
}

// Runs in the page. Pulls JSON-LD, meta, and a main-content-biased innerText.
const EXTRACT_FN = `(() => {
  const pick = (sel) => document.querySelector(sel);
  const main =
    pick('[data-testid="jobDescriptionText"]') ||
    pick('.jobs-description__content') ||
    pick('#job-details') ||
    pick('main') ||
    pick('article') ||
    pick('[role="main"]') ||
    document.body;
  const meta = {};
  for (const m of document.querySelectorAll('meta[property], meta[name]')) {
    const k = m.getAttribute('property') || m.getAttribute('name');
    const v = m.getAttribute('content');
    if (k && v && !(k in meta)) meta[k] = v;
  }
  const jsonLd = [];
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    const t = (s.textContent || '').trim();
    if (t) jsonLd.push(t);
  }
  return {
    finalUrl: location.href,
    title: document.title || '',
    text: (main && main.innerText ? main.innerText : document.body.innerText || ''),
    html: document.documentElement.outerHTML,
    jsonLdRaw: jsonLd,
    meta,
  };
})()`

function collapse(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function renderPage(url: string, timeoutMs = 25_000): Promise<RenderedPage> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      partition: SCRAPER_PARTITION,
      images: false,
      javascript: true,
      backgroundThrottling: false,
    },
  })
  win.webContents.setUserAgent(USER_AGENT)

  const cleanup = () => {
    if (!win.isDestroyed()) win.destroy()
  }

  try {
    const settle = new Promise<void>((resolve) => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        resolve()
      }
      win.webContents.once('did-stop-loading', () => setTimeout(finish, 1500))
      win.webContents.once('did-finish-load', () => setTimeout(finish, 1500))
      setTimeout(finish, timeoutMs)
    })

    await win.loadURL(url).catch(() => {
      /* keep going — some pages "fail" on subresources but the DOM is fine */
    })
    await settle

    const raw = (await win.webContents.executeJavaScript(EXTRACT_FN, true)) as {
      finalUrl: string
      title: string
      text: string
      html: string
      jsonLdRaw: string[]
      meta: Record<string, string>
    }

    const jsonLd: unknown[] = []
    for (const block of raw.jsonLdRaw ?? []) {
      try {
        jsonLd.push(JSON.parse(block))
      } catch {
        /* ignore malformed JSON-LD */
      }
    }

    return {
      finalUrl: raw.finalUrl || url,
      title: raw.title ?? '',
      text: collapse(raw.text ?? ''),
      html: raw.html ?? '',
      jsonLd,
      meta: raw.meta ?? {},
    }
  } finally {
    cleanup()
  }
}

/** Open a visible window on the scraper session so a login (LinkedIn) sticks. */
export function openLoginWindow(url: string): void {
  const win = new BrowserWindow({
    show: true,
    width: 980,
    height: 820,
    title: 'Log in — the session is remembered for scraping',
    webPreferences: { partition: SCRAPER_PARTITION },
  })
  win.webContents.setUserAgent(USER_AGENT)
  void win.loadURL(url)
}

export async function fetchText(
  url: string,
  headers: Record<string, string> = {},
): Promise<{ ok: boolean; status: number; body: string; contentType: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: '*/*', ...headers },
      redirect: 'follow',
    })
    const body = await res.text()
    return {
      ok: res.ok,
      status: res.status,
      body,
      contentType: res.headers.get('content-type') ?? '',
    }
  } catch {
    return { ok: false, status: 0, body: '', contentType: '' }
  }
}
