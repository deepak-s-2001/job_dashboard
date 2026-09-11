import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFileSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getOrCreateExtensionToken,
  matchApplicationForUrl,
  getProfile,
  mutateApplication,
  dataDir,
} from './store'

/**
 * Local API the companion browser extension talks to, entirely over loopback.
 * Deliberately a plain in-process HTTP server (not Native Messaging's stdio
 * host) — the trade the user chose for build/iteration speed over "no
 * listening socket at all." Hardened: 127.0.0.1 only, a pairing token
 * required on every request, a light rate limit.
 *
 * Origin is checked only loosely (must be *some* `chrome-extension://`
 * origin, not a specific pinned ID) — pinning to one exact ID (derived from
 * the extension's manifest key) checked out correctly in isolated testing
 * but still failed in practice twice, and there's no way to verify from here
 * whether Chrome's "key"-based ID pinning is actually taking effect for a
 * given sideloaded install. The pairing token (random, 48 hex chars) is the
 * real secret boundary either way, so this trades a small amount of
 * defense-in-depth for the check actually working reliably.
 */

const PORT = 47821

/**
 * Every request/auth-decision gets appended here — this app has no visible
 * console once packaged, so this is the only way to see what the extension
 * actually sent when a user reports "Unauthorized" and everything looks
 * right from both ends. Never write the full token — mask it so this file
 * stays safe to paste into a chat/issue if needed.
 */
const LOG_PATH_NAME = 'autofill-server.log'
function logLine(msg: string): void {
  try {
    appendFileSync(join(dataDir(), LOG_PATH_NAME), `${new Date().toISOString()} ${msg}\n`)
  } catch {
    /* logging must never break the request it's logging */
  }
}
function mask(s: string | undefined | null): string {
  if (!s) return '(none)'
  if (s.length <= 8) return `(len ${s.length}, too short to mask usefully)`
  return `${s.slice(0, 4)}…${s.slice(-4)} (len ${s.length})`
}

function isExtensionOrigin(origin: string | undefined): origin is string {
  return !!origin && origin.startsWith('chrome-extension://')
}

function corsHeaders(origin: string | undefined): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': isExtensionOrigin(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'X-Autofill-Token',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  }
}

let server: Server | null = null

function send(res: ServerResponse, status: number, body: unknown, origin?: string): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders(origin) })
  res.end(json)
}

// naive per-token sliding-window limiter — cheap insurance, not load-bearing security
const RATE_LIMIT = 60 // requests
const RATE_WINDOW_MS = 60_000
const hits = new Map<string, number[]>()
function rateLimited(token: string): boolean {
  const now = Date.now()
  const recent = (hits.get(token) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(token, recent)
  return recent.length > RATE_LIMIT
}

type AuthResult = { ok: true; token: string } | { ok: false; reason: string }

async function authorize(req: IncomingMessage): Promise<AuthResult> {
  const origin = req.headers.origin
  const tokenHeader = req.headers['x-autofill-token']
  const token = typeof tokenHeader === 'string' ? tokenHeader : undefined
  const real = await getOrCreateExtensionToken()

  logLine(
    `auth: origin=${JSON.stringify(origin)} tokenHeaderPresent=${tokenHeader !== undefined} ` +
      `tokenHeaderCount=${Array.isArray(tokenHeader) ? tokenHeader.length : 1} ` +
      `received=${mask(token)} expected=${mask(real)} exactMatch=${token === real}`,
  )

  if (!isExtensionOrigin(origin)) {
    logLine(`  -> REJECTED: wrong-origin (got ${JSON.stringify(origin)})`)
    return { ok: false, reason: 'wrong-origin' }
  }
  if (!token) {
    logLine('  -> REJECTED: missing-token')
    return { ok: false, reason: 'missing-token' }
  }
  if (token !== real) {
    // exactMatch already logged above, but spell out WHERE they diverge —
    // this is the one thing "looks identical" character-count checks can't show.
    let diffAt = -1
    for (let i = 0; i < Math.max(token.length, real.length); i++) {
      if (token[i] !== real[i]) {
        diffAt = i
        break
      }
    }
    logLine(
      `  -> REJECTED: wrong-token (lengths: received=${token.length} expected=${real.length}, first differs at index ${diffAt})`,
    )
    return { ok: false, reason: 'wrong-token' }
  }
  logLine('  -> accepted')
  return { ok: true, token }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)
  const origin = req.headers.origin
  const s = (status: number, body: unknown) => send(res, status, body, origin)

  logLine(
    `${req.method} ${url.pathname}${url.search} — headers: ${JSON.stringify({
      origin: req.headers.origin,
      'x-autofill-token': mask(
        typeof req.headers['x-autofill-token'] === 'string'
          ? (req.headers['x-autofill-token'] as string)
          : undefined,
      ),
      'access-control-request-headers': req.headers['access-control-request-headers'],
      'access-control-request-method': req.headers['access-control-request-method'],
      'user-agent': req.headers['user-agent'],
    })}`,
  )

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin))
    res.end()
    logLine(`  OPTIONS preflight answered 204, Access-Control-Allow-Origin=${corsHeaders(origin)['Access-Control-Allow-Origin']}`)
    return
  }

  // /health is unauthenticated on purpose — it only ever answers "is Job
  // Dashboard running", nothing about the user's data.
  if (url.pathname === '/health') {
    s(200, { ok: true })
    return
  }

  const auth = await authorize(req)
  if (!auth.ok) {
    const message =
      auth.reason === 'wrong-origin'
        ? 'Unauthorized — this request did not come from a browser extension.'
        : 'Unauthorized — check the pairing token in the extension options.'
    s(401, { error: message, reason: auth.reason })
    return
  }
  const token = auth.token
  if (rateLimited(token)) {
    s(429, { error: 'Too many requests.' })
    return
  }

  if (url.pathname === '/lookup' && req.method === 'GET') {
    const target = url.searchParams.get('url') ?? ''
    const match = matchApplicationForUrl(target)
    const profile = getProfile()
    if (match.status === 'match') {
      s(200, { status: 'match', application: match.application, profile })
    } else if (match.status === 'ambiguous') {
      s(200, { status: 'ambiguous', candidates: match.candidates, profile })
    } else {
      s(200, { status: 'none' })
    }
    return
  }

  const fileMatch = /^\/resume-file\/([A-Za-z0-9_-]+)$/.exec(url.pathname)
  if (fileMatch && req.method === 'GET') {
    const app_ = mutateApplication(fileMatch[1])
    if (!app_) {
      s(404, { error: 'Application not found.' })
      return
    }
    const primary = app_.resumes.find((r) => r.isPrimary) ?? app_.resumes[0]
    if (!primary) {
      s(404, { error: 'No resume attached to this application.' })
      return
    }
    try {
      const bytes = readFileSync(primary.storedPath)
      s(200, { filename: primary.filename, base64: bytes.toString('base64') })
    } catch {
      s(404, { error: 'The stored PDF is missing from disk.' })
    }
    return
  }

  s(404, { error: 'Not found.' })
}

export async function startLocalServer(): Promise<void> {
  if (server) return
  await getOrCreateExtensionToken() // ensure it exists before the extension can ever ask for it
  server = createServer((req, res) => {
    void handle(req, res).catch((err) => {
      send(res, 500, { error: err instanceof Error ? err.message : 'Server error' }, req.headers.origin)
    })
  })
  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject)
    server?.listen(PORT, '127.0.0.1', () => resolve())
  })
}

export function stopLocalServer(): void {
  server?.close()
  server = null
}

export function localServerPort(): number {
  return PORT
}
