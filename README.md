# Job Dashboard

An offline **Windows desktop app** for documenting every job application you send: the job link,
the description, the company, the skills the JD asks for, notes to remember when tailoring your
resume, and the resume PDF(s) you actually attached — all browsable on one colourful board with
search and filters.

Built with Electron + React + TypeScript. Your data stays on your machine — a single local
`db.json` plus your resume files. The only outbound request is one optional call to the
Anthropic API, and only when you press **Extract**.

## The flow

1. **Paste a job link.** The app opens the page and pulls out the company, role, location,
   posting date and the full job description — no AI, just structured data and the page text.
   Dedicated readers for **Greenhouse, Lever, Ashby, Workday and LinkedIn**; anything else falls
   back to reading the page directly, with a manual-paste box if a site blocks it.
2. **Review the fields**, then either:
   - **Extract & Save** — one cheap Claude call adds required/preferred/industry **skills**,
     a summary, **company insights** and **resume tailoring tips**; or
   - **Save without AI** — 0 API calls, just the scraped facts and the JD.
3. **Attach the resume** you sent for that job. It renders exactly (pdf.js), and you can keep
   multiple versions per application.

Everything after that is browsing: search (fuzzy, across company / role / skills / JD / notes),
filter by status / employment type / workplace / date / tag / source, and a per-application
detail view with the resume beside the JD, skills, insights and tips.

## AI cost

One Claude call per job, only when you press **Extract** (or **Re-run extraction**). Nothing
runs automatically or in the background.

| Model (Settings) | Cost per job | Good for |
|---|---|---|
| Claude Haiku 4.5 *(default)* | ~$0.007 | skills, keywords, summary |
| Claude Sonnet 5 | ~$0.015 | richer company insights & tailoring tips |

≈ 100 documented jobs for under $1 on Haiku. Add your key in **Settings** — it is stored
OS-encrypted (`safeStorage`), never written to `db.json`, and only ever sent to Anthropic.

## Develop

```bash
npm install
npm run dev          # electron-vite dev server + hot reload
npm run typecheck    # tsc for main + renderer
npm run build        # compile to out/
```

## Package a Windows installer

```bash
npm run dist         # -> release/Job Dashboard-Setup-<version>.exe  (NSIS, unsigned)
```

Requires `electron-builder` ≥ 26 (older versions fail to unpack a signing tool on Windows
without Developer Mode). The installer is unsigned, so SmartScreen will warn on first run —
"More info → Run anyway".

The app icon is generated from `build/make_icon.py` (Pillow): `python build/make_icon.py`.

## Where your data lives

`%APPDATA%\job-dashboard\`
- `db.json` — every application record
- `resumes\<appId>\*.pdf` — attached resumes (copies of the files you pick; originals untouched)
- `backups\db-*.json` — automatic `db.json` snapshots (on launch + before a delete/restore; last 20)
- `secrets.bin` — the API key, `safeStorage`-encrypted

**Settings → Export a copy now** writes `db.json` + all resumes into a folder you choose.
**Settings → Automatic backups** lists the snapshots and restores one.

## Privacy & security

- **Nothing phones home.** The only outbound request is the Anthropic API call you trigger with
  **Extract**. The renderer's CSP blocks it from making any network request at all.
- **The API key** lives only in the main process, encrypted at rest via the OS keychain
  (`safeStorage`). It is never exposed to the UI over IPC, never written to `db.json`, and never
  included in an export or a backup.
- The window that renders your PDFs and scraped job text runs sandboxed, cannot navigate off its
  own page, and job pages are scraped in a separate window with no access to app internals.
- The installer is **unsigned** — SmartScreen will warn on first run ("More info → Run anyway").

## LinkedIn

Some LinkedIn job pages need you signed in. **Settings → Log in to LinkedIn** opens a window
whose session is remembered and reused whenever you paste a LinkedIn link.

## Troubleshooting

A job link didn't parse well? Run the scraper directly to see what it got:

```bash
MSYS_NO_PATHCONV=1 SMOKE_SCRAPE="<url>" npx electron .
```

(`SMOKE`, `SMOKE_HASH`, `SMOKE_EVAL` similarly drive a one-off screenshot for UI debugging.
These hooks, and the `JOBDASH_DATA_DIR` override, are compiled out of the packaged build —
they only work when running from source.)

## Architecture

```
src/main/       Electron main — store (atomic JSON), IPC, Anthropic call, file handling
  scraper/      per-ATS adapters + hidden-window render + JSON-LD parse + deterministic parse
src/preload/    typed contextBridge API (window.api)
src/renderer/   React SPA — routes, neobrutalist component set, Fuse.js search, pdf.js viewer
src/shared/     types + IPC channel names, imported by both sides
```

## License

MIT — see [LICENSE](LICENSE). Do whatever you want with it; no warranty.
