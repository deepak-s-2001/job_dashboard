import { app } from 'electron'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import type {
  Application,
  Contact,
  DBShape,
  ExtractionModel,
  NewApplicationInput,
  NewContactInput,
  NewTodoInput,
  TagDef,
  Todo,
  UsageTotals,
  UserProfile,
} from '@shared/types'
import { ACCENTS, EMPTY_PROFILE } from '@shared/types'
import { parseSalary } from '@shared/salary'
import { JsonDb, genId } from './jsondb'

const DB_VERSION = 1

let db: JsonDb<DBShape>

const defaultData: DBShape = {
  version: DB_VERSION,
  applications: [],
  contacts: [],
  todos: [],
  tags: [],
  usage: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 },
  settings: { extractionModel: 'claude-haiku-4-5', profile: { ...EMPTY_PROFILE } },
}

export function dataDir(): string {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function resumesDir(): string {
  const dir = join(dataDir(), 'resumes')
  mkdirSync(dir, { recursive: true })
  return dir
}

export function dbPath(): string {
  return join(dataDir(), 'db.json')
}

export function backupsDir(): string {
  const dir = join(dataDir(), 'backups')
  mkdirSync(dir, { recursive: true })
  return dir
}

const KEEP_BACKUPS = 40
const BACKUP_RE = /^db-\d{4}-\d\d-\d\d.*\.json$/

function listBackupFiles(): string[] {
  try {
    return readdirSync(backupsDir()).filter((f) => BACKUP_RE.test(f)).sort()
  } catch {
    return []
  }
}

function pruneBackups(): void {
  const files = listBackupFiles()
  for (const f of files.slice(0, Math.max(0, files.length - KEEP_BACKUPS))) {
    rmSync(join(backupsDir(), f), { force: true })
  }
}

/** Comparison key: applications + contacts + tags only, so usage/settings churn
 *  doesn't spawn backups and formatting differences are ignored. */
function backupKey(json: string): string {
  try {
    const j = JSON.parse(json) as DBShape
    return JSON.stringify({
      a: j.applications ?? [],
      c: j.contacts ?? [],
      d: j.todos ?? [],
      t: j.tags ?? [],
    })
  } catch {
    return json
  }
}

/**
 * Immutable, content-deduplicated snapshot of db.json. Called on launch and
 * right before a delete/restore. A new file is written only when the set of
 * applications or tags actually changed since the last snapshot; each one gets
 * its own timestamped name (a later launch never overwrites an earlier one), so
 * a mistake stays recoverable until KEEP_BACKUPS newer snapshots push it out.
 */
export function snapshot(): void {
  const src = dbPath()
  if (!existsSync(src)) return
  try {
    const content = readFileSync(src, 'utf8')
    const files = listBackupFiles()
    const newest = files[files.length - 1]
    if (
      newest &&
      backupKey(readFileSync(join(backupsDir(), newest), 'utf8')) === backupKey(content)
    ) {
      pruneBackups()
      return
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) // 2026-09-06T16-13-05
    writeFileSync(join(backupsDir(), `db-${stamp}.json`), content, 'utf8')
    pruneBackups()
  } catch {
    /* backups are best-effort, never block startup or a write */
  }
}

/** Fill fields added in later versions on an application loaded from disk. */
function migrateApplication(a: Application): void {
  a.contactIds ??= []
  a.interviews ??= []
  a.offerDeadline ??= null
  a.archivedAt ??= null
  if (a.salaryMin === undefined && a.salaryMax === undefined) {
    const p = parseSalary(a.salaryRange)
    a.salaryMin = p.min
    a.salaryMax = p.max
    a.salaryPeriod = p.period
  }
  a.salaryMin ??= null
  a.salaryMax ??= null
  a.salaryPeriod ??= null
  a.jobPostingId ??= null
  if (!a.statusHistory || a.statusHistory.length === 0) {
    a.statusHistory = [
      { status: a.status, at: a.dateApplied ? `${a.dateApplied}T12:00:00.000Z` : a.createdAt },
    ]
  }
}

export async function initStore(): Promise<void> {
  snapshot()
  db = JsonDb.open<DBShape>(dbPath(), defaultData)
  // shallow migration guard for older db.json files
  db.data.version = DB_VERSION
  db.data.applications ??= []
  db.data.contacts ??= []
  db.data.todos ??= []
  db.data.tags ??= []
  db.data.usage ??= { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
  db.data.settings ??= { extractionModel: 'claude-haiku-4-5', profile: { ...EMPTY_PROFILE } }
  db.data.settings.profile ??= { ...EMPTY_PROFILE }
  db.data.applications.forEach(migrateApplication)
  await db.flushNow()
}

export async function shutdownStore(): Promise<void> {
  if (db) await db.flushNow()
}

export interface BackupInfo {
  name: string
  savedAt: string
  label: string
  applications: number
}

function labelFor(name: string): string {
  const m = name.match(/^db-(\d{4})-(\d\d)-(\d\d)(?:T(\d\d)-(\d\d)-(\d\d))?/)
  if (!m) return name
  const [, y, mo, d, hh, mi] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(hh ?? 0), Number(mi ?? 0))
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(hh ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

export function listBackups(): BackupInfo[] {
  try {
    return listBackupFiles()
      .reverse()
      .map((name) => {
        const p = join(backupsDir(), name)
        let applications = 0
        try {
          applications = (JSON.parse(readFileSync(p, 'utf8')) as DBShape).applications.length
        } catch {
          /* ignore */
        }
        return {
          name,
          savedAt: statSync(p).mtime.toISOString(),
          label: labelFor(name),
          applications,
        }
      })
  } catch {
    return []
  }
}

export async function restoreBackup(name: string): Promise<number> {
  // strip any path segments before validating — a name like 'db-2024-01-01/../../x.json'
  // would otherwise still match BACKUP_RE and escape backupsDir() via '..'
  const safe = basename(name)
  if (!BACKUP_RE.test(safe)) throw new Error('Bad backup name.')
  const src = join(backupsDir(), safe)
  if (!existsSync(src)) throw new Error('That backup is gone.')
  // snapshot the current state (distinct-content dedup) so the restore is reversible
  await db.flushNow()
  snapshot()
  const restored = JSON.parse(readFileSync(src, 'utf8')) as DBShape
  db.data.version = DB_VERSION
  db.data.applications = restored.applications ?? []
  db.data.contacts = restored.contacts ?? []
  db.data.todos = restored.todos ?? []
  db.data.tags = restored.tags ?? []
  db.data.usage = restored.usage ?? db.data.usage
  db.data.settings = restored.settings ?? db.data.settings
  db.data.settings.profile ??= { ...EMPTY_PROFILE }
  db.data.applications.forEach(migrateApplication)
  await db.flushNow()
  return db.data.applications.length
}

function nowIso(): string {
  return new Date().toISOString()
}

function pickAccent(seed: string): (typeof ACCENTS)[number] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ACCENTS[h % ACCENTS.length]
}

// ---------- applications ----------

export function listApplications(): Application[] {
  return [...db.data.applications].sort((a, b) =>
    b.dateApplied.localeCompare(a.dateApplied) || b.createdAt.localeCompare(a.createdAt),
  )
}

export function getApplication(id: string): Application | undefined {
  return db.data.applications.find((a) => a.id === id)
}

/** Loose URL identity for dedup: no protocol, query, hash or trailing slash. */
export function normalizeUrl(url: string): string {
  const s = (url ?? '').trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    return (u.host + u.pathname).replace(/\/+$/, '').toLowerCase()
  } catch {
    return s.replace(/^https?:\/\//i, '').split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase()
  }
}

export function findApplicationByUrl(url: string): Application | undefined {
  const key = normalizeUrl(url)
  if (!key) return undefined
  return db.data.applications.find((a) => a.url && normalizeUrl(a.url) === key)
}

function seedStatusAt(dateApplied: string, ts: string): string {
  return dateApplied ? `${dateApplied}T12:00:00.000Z` : ts
}

function buildApplication(input: NewApplicationInput, ts: string): Application {
  const id = genId(12)
  const ex = input.extraction
  // hard facts: the user's form value wins; fall back to what the AI pulled from the JD body
  const salaryRange = input.salaryRange ?? ex?.salaryRaw ?? null
  const parsed = parseSalary(salaryRange)
  return {
    id,
    url: input.url,
    sourceSite: input.sourceSite,
    company: input.company.trim(),
    roleTitle: input.roleTitle.trim(),
    location: input.location ?? ex?.location ?? null,
    workplaceType: input.workplaceType,
    employmentType: input.employmentType,
    datePosted: input.datePosted ?? ex?.datePosted ?? null,
    salaryRange,
    salaryMin: input.salaryMin ?? ex?.salaryMin ?? parsed.min,
    salaryMax: input.salaryMax ?? ex?.salaryMax ?? parsed.max,
    salaryPeriod: input.salaryPeriod ?? ex?.salaryPeriod ?? parsed.period,
    jobPostingId: input.jobPostingId ?? ex?.jobPostingId ?? null,
    jdText: input.jdText,
    dateApplied: input.dateApplied,
    status: input.status,
    statusHistory: [{ status: input.status, at: seedStatusAt(input.dateApplied, ts) }],
    interviews: [],
    offerDeadline: null,
    archivedAt: null,
    accent: pickAccent(id + input.company),
    tags: dedupeTags(input.tags),
    notes: input.notes ?? '',
    contactIds: input.contactIds ?? [],
    extracted: !!ex,
    extractionModel: ex?._model ?? null,
    extractedAt: ex ? ts : null,
    seniority: ex?.seniority ?? null,
    jdSummary: ex?.jdSummary ?? '',
    responsibilities: ex?.responsibilities ?? [],
    skills: {
      required: ex?.requiredSkills ?? [],
      preferred: ex?.preferredSkills ?? [],
      industry: ex?.industryKeywords ?? [],
    },
    companyInsights: ex?.companyInsights ?? [],
    tailoringTips: ex?.tailoringTips ?? [],
    extractionRaw: ex?._raw ?? null,
    resumes: [],
    createdAt: ts,
    updatedAt: ts,
  }
}

export async function createApplication(input: NewApplicationInput): Promise<Application> {
  const application = buildApplication(input, nowIso())
  db.data.applications.push(application)
  await registerTags(application.tags)
  await db.write()
  return application
}

/** Create many at once — one disk write, one tag pass. Skips rows with no company or role. */
export async function bulkCreateApplications(
  inputs: NewApplicationInput[],
): Promise<Application[]> {
  const ts = nowIso()
  const created: Application[] = []
  for (const input of inputs) {
    if (!input.company?.trim() && !input.roleTitle?.trim()) continue
    const app_ = buildApplication(input, ts)
    db.data.applications.push(app_)
    created.push(app_)
  }
  await registerTags(created.flatMap((a) => a.tags))
  await db.write()
  return created
}

const MUTABLE_FIELDS: (keyof Application)[] = [
  'company',
  'roleTitle',
  'location',
  'workplaceType',
  'employmentType',
  'datePosted',
  'salaryRange',
  'salaryMin',
  'salaryMax',
  'salaryPeriod',
  'jobPostingId',
  'jdText',
  'dateApplied',
  'status',
  'tags',
  'notes',
  'contactIds',
  'seniority',
  'jdSummary',
  'responsibilities',
  'skills',
  'companyInsights',
  'tailoringTips',
  'interviews',
  'offerDeadline',
  'archivedAt',
]

export async function updateApplication(
  id: string,
  patch: Partial<Application>,
): Promise<Application | undefined> {
  const app_ = db.data.applications.find((a) => a.id === id)
  if (!app_) return undefined
  if (patch.status && patch.status !== app_.status) {
    ;(app_.statusHistory ??= []).push({ status: patch.status, at: nowIso() })
  }
  for (const key of MUTABLE_FIELDS) {
    if (key in patch && patch[key] !== undefined) {
      // @ts-expect-error narrowed by the whitelist above
      app_[key] = patch[key]
    }
  }
  if (patch.tags) {
    app_.tags = dedupeTags(patch.tags)
    await registerTags(app_.tags)
  }
  app_.updatedAt = nowIso()
  await db.write()
  return app_
}

export async function applyExtraction(
  id: string,
  ex: NonNullable<NewApplicationInput['extraction']>,
): Promise<Application | undefined> {
  const app_ = db.data.applications.find((a) => a.id === id)
  if (!app_) return undefined
  app_.extracted = true
  app_.extractionModel = ex._model
  app_.extractedAt = nowIso()
  app_.seniority = ex.seniority
  app_.jdSummary = ex.jdSummary
  app_.responsibilities = ex.responsibilities
  app_.skills = {
    required: ex.requiredSkills,
    preferred: ex.preferredSkills,
    industry: ex.industryKeywords,
  }
  app_.companyInsights = ex.companyInsights
  app_.tailoringTips = ex.tailoringTips
  // fill hard facts only where the user hasn't already set them
  if (!app_.location && ex.location) app_.location = ex.location
  if (!app_.datePosted && ex.datePosted) app_.datePosted = ex.datePosted
  if (!app_.jobPostingId && ex.jobPostingId) app_.jobPostingId = ex.jobPostingId
  if (!app_.salaryRange && ex.salaryRaw) app_.salaryRange = ex.salaryRaw
  if (app_.salaryMin == null && ex.salaryMin != null) app_.salaryMin = ex.salaryMin
  if (app_.salaryMax == null && ex.salaryMax != null) app_.salaryMax = ex.salaryMax
  if (!app_.salaryPeriod && ex.salaryPeriod) app_.salaryPeriod = ex.salaryPeriod
  app_.extractionRaw = ex._raw
  app_.updatedAt = nowIso()
  await db.write()
  return app_
}

export async function deleteApplication(id: string): Promise<void> {
  await db.flushNow() // make sure disk = current state …
  snapshot() // … then capture it before removing anything (content-deduped)
  db.data.applications = db.data.applications.filter((a) => a.id !== id)
  // keep the tasks, drop the link
  for (const t of db.data.todos) if (t.applicationId === id) t.applicationId = null
  await db.write()
}

export function mutateApplication(id: string): Application | undefined {
  return db.data.applications.find((a) => a.id === id)
}

export async function bulkArchive(ids: string[], archived: boolean): Promise<number> {
  const set = new Set(ids)
  const ts = archived ? nowIso() : null
  let n = 0
  for (const a of db.data.applications) {
    if (set.has(a.id) && !!a.archivedAt !== archived) {
      a.archivedAt = ts
      a.updatedAt = nowIso()
      n++
    }
  }
  if (n) await db.write()
  return n
}

export async function persist(): Promise<void> {
  await db.write()
}

// ---------- tags ----------

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags ?? []) {
    const t = raw.trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

const TAG_COLORS = ['pink', 'yellow', 'cyan', 'blue', 'lime', 'coral', 'purple']

async function registerTags(tags: string[]): Promise<void> {
  let changed = false
  for (const name of tags) {
    if (!db.data.tags.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      db.data.tags.push({ name, color: TAG_COLORS[db.data.tags.length % TAG_COLORS.length] })
      changed = true
    }
  }
  if (changed) await db.write()
}

export function listTags(): TagDef[] {
  return [...db.data.tags].sort((a, b) => a.name.localeCompare(b.name))
}

export async function upsertTag(tag: TagDef): Promise<void> {
  const existing = db.data.tags.find((t) => t.name.toLowerCase() === tag.name.toLowerCase())
  if (existing) existing.color = tag.color
  else db.data.tags.push(tag)
  await db.write()
}

export async function deleteTag(name: string): Promise<void> {
  db.data.tags = db.data.tags.filter((t) => t.name.toLowerCase() !== name.toLowerCase())
  for (const a of db.data.applications) {
    a.tags = a.tags.filter((t) => t.toLowerCase() !== name.toLowerCase())
  }
  await db.write()
}

// ---------- contacts ----------

export function listContacts(): Contact[] {
  return [...db.data.contacts].sort((a, b) => a.name.localeCompare(b.name))
}

export function getContact(id: string): Contact | undefined {
  return db.data.contacts.find((c) => c.id === id)
}

function cleanLinks(links: unknown): Contact['links'] {
  if (!Array.isArray(links)) return []
  return links
    .map((l) => ({
      label: String((l as { label?: unknown })?.label ?? '').trim(),
      url: String((l as { url?: unknown })?.url ?? '').trim(),
    }))
    .filter((l) => l.url)
}

export async function createContact(input: NewContactInput): Promise<Contact> {
  const ts = nowIso()
  const contact: Contact = {
    id: genId(12),
    name: input.name.trim(),
    email: input.email.trim(),
    company: input.company.trim(),
    title: input.title.trim(),
    relationship: input.relationship,
    linkedinUrl: input.linkedinUrl.trim(),
    links: cleanLinks(input.links),
    howYouKnow: input.howYouKnow.trim(),
    notes: input.notes.trim(),
    createdAt: ts,
    updatedAt: ts,
  }
  db.data.contacts.push(contact)
  await db.write()
  return contact
}

const CONTACT_FIELDS: (keyof Contact)[] = [
  'name',
  'email',
  'company',
  'title',
  'relationship',
  'linkedinUrl',
  'links',
  'howYouKnow',
  'notes',
]

export async function updateContact(
  id: string,
  patch: Partial<Contact>,
): Promise<Contact | undefined> {
  const c = db.data.contacts.find((x) => x.id === id)
  if (!c) return undefined
  for (const key of CONTACT_FIELDS) {
    if (key in patch && patch[key] !== undefined) {
      // @ts-expect-error narrowed by the whitelist
      c[key] = key === 'links' ? cleanLinks(patch.links) : patch[key]
    }
  }
  c.updatedAt = nowIso()
  await db.write()
  return c
}

export async function deleteContact(id: string): Promise<void> {
  await db.flushNow()
  snapshot()
  db.data.contacts = db.data.contacts.filter((c) => c.id !== id)
  for (const a of db.data.applications) {
    if (a.contactIds?.includes(id)) a.contactIds = a.contactIds.filter((x) => x !== id)
  }
  await db.write()
}

// ---------- to-dos ----------

export function listTodos(): Todo[] {
  return [...db.data.todos]
}

export function getTodo(id: string): Todo | undefined {
  return db.data.todos.find((t) => t.id === id)
}

export async function createTodo(input: NewTodoInput): Promise<Todo> {
  const text = (input.text ?? '').trim()
  if (!text) throw new Error('A to-do needs some text.')
  const ts = nowIso()
  const todo: Todo = {
    id: genId(12),
    text,
    done: false,
    doneAt: null,
    applicationId: input.applicationId ?? null,
    dueDate: input.dueDate ?? null,
    createdAt: ts,
    updatedAt: ts,
  }
  db.data.todos.push(todo)
  await db.write()
  return todo
}

const TODO_FIELDS: (keyof Todo)[] = ['text', 'done', 'doneAt', 'applicationId', 'dueDate']

export async function updateTodo(id: string, patch: Partial<Todo>): Promise<Todo | undefined> {
  const t = db.data.todos.find((x) => x.id === id)
  if (!t) return undefined
  for (const key of TODO_FIELDS) {
    if (key in patch && patch[key] !== undefined) {
      // @ts-expect-error narrowed by the whitelist
      t[key] = key === 'text' ? String(patch.text).trim() : patch[key]
    }
  }
  if ('done' in patch) t.doneAt = patch.done ? nowIso() : null
  t.updatedAt = nowIso()
  await db.write()
  return t
}

export async function deleteTodo(id: string): Promise<void> {
  db.data.todos = db.data.todos.filter((t) => t.id !== id)
  await db.write()
}

// ---------- settings + usage ----------

export function getProfile(): UserProfile {
  return { ...EMPTY_PROFILE, ...db.data.settings.profile }
}

export async function setProfile(p: UserProfile): Promise<void> {
  db.data.settings.profile = {
    name: (p.name ?? '').trim(),
    email: (p.email ?? '').trim(),
    phone: (p.phone ?? '').trim(),
    linkedinUrl: (p.linkedinUrl ?? '').trim(),
  }
  await db.write()
}

export function getModel(): ExtractionModel {
  return db.data.settings.extractionModel
}

export async function setModel(model: ExtractionModel): Promise<void> {
  db.data.settings.extractionModel = model
  await db.write()
}

export function getUsage(): UsageTotals {
  return { ...db.data.usage }
}

export async function addUsage(inputTokens: number, outputTokens: number, usd: number): Promise<void> {
  db.data.usage.calls += 1
  db.data.usage.inputTokens += inputTokens
  db.data.usage.outputTokens += outputTokens
  db.data.usage.estimatedUsd += usd
  await db.write()
}
