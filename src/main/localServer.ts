import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import {
  getOrCreateExtensionToken,
  matchApplicationForUrl,
  getProfile,
  mutateApplication,
} from './store'

/**
 * Local API the companion browser extension talks to, entirely over loopback.
 * Deliberately a plain in-process HTTP server (not Native Messaging's stdio
 * host) — the trade the user chose for build/iteration speed over "no
 * listening socket at all." Hardened anyway: 127.0.0.1 only, an Origin check
 * pinned to the extension's one stable ID, a pairing token on every request,
 * and a light rate limit — a network-facing surface, but not a bare open one.
 */

const PORT = 47821
// The extension's ID is stable because its manifest.json embeds a persistent
// public key (see job-dashboard-extension/scripts/gen-key.mjs) — otherwise a
// sideloaded extension's ID changes with its install path.
const ALLOWED_ORIGIN = 'chrome-extension://biiapmgpkgfpncdjgibiloebpmcfpeml'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'X-Autofill-Token',
}

let server: Server | null = null

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS })
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
  if (req.headers.origin !== ALLOWED_ORIGIN) {
    console.error(
      `[localServer] rejected request from Origin "${req.headers.origin}" — expected "${ALLOWED_ORIGIN}". If this is really the extension, its Chrome-assigned ID doesn't match what this app allows; check chrome://extensions and the extension's Options page for its actual ID.`,
    )
    return { ok: false, reason: 'wrong-origin' }
  }
  const token = req.headers['x-autofill-token']
  if (typeof token !== 'string' || !token) return { ok: false, reason: 'missing-token' }
  const real = await getOrCreateExtensionToken()
  if (token !== real) {
    console.error('[localServer] rejected request with a pairing token that does not match.')
    return { ok: false, reason: 'wrong-token' }
  }
  return { ok: true, token }
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`)

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS)
    res.end()
    return
  }

  // /health is unauthenticated on purpose — it only ever answers "is Job
  // Dashboard running", nothing about the user's data.
  if (url.pathname === '/health') {
    send(res, 200, { ok: true })
    return
  }

  const auth = await authorize(req)
  if (!auth.ok) {
    const message =
      auth.reason === 'wrong-origin'
        ? 'Unauthorized — this request did not come from the paired extension (its ID may not match what this app allows).'
        : 'Unauthorized — check the pairing token in the extension options.'
    send(res, 401, { error: message, reason: auth.reason })
    return
  }
  const token = auth.token
  if (rateLimited(token)) {
    send(res, 429, { error: 'Too many requests.' })
    return
  }

  if (url.pathname === '/lookup' && req.method === 'GET') {
    const target = url.searchParams.get('url') ?? ''
    const match = matchApplicationForUrl(target)
    const profile = getProfile()
    if (match.status === 'match') {
      send(res, 200, { status: 'match', application: match.application, profile })
    } else if (match.status === 'ambiguous') {
      send(res, 200, { status: 'ambiguous', candidates: match.candidates, profile })
    } else {
      send(res, 200, { status: 'none' })
    }
    return
  }

  const fileMatch = /^\/resume-file\/([A-Za-z0-9_-]+)$/.exec(url.pathname)
  if (fileMatch && req.method === 'GET') {
    const app_ = mutateApplication(fileMatch[1])
    if (!app_) {
      send(res, 404, { error: 'Application not found.' })
      return
    }
    const primary = app_.resumes.find((r) => r.isPrimary) ?? app_.resumes[0]
    if (!primary) {
      send(res, 404, { error: 'No resume attached to this application.' })
      return
    }
    try {
      const bytes = readFileSync(primary.storedPath)
      send(res, 200, { filename: primary.filename, base64: bytes.toString('base64') })
    } catch {
      send(res, 404, { error: 'The stored PDF is missing from disk.' })
    }
    return
  }

  send(res, 404, { error: 'Not found.' })
}

export async function startLocalServer(): Promise<void> {
  if (server) return
  await getOrCreateExtensionToken() // ensure it exists before the extension can ever ask for it
  server = createServer((req, res) => {
    void handle(req, res).catch((err) => {
      send(res, 500, { error: err instanceof Error ? err.message : 'Server error' })
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
