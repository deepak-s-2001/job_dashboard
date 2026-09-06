import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type {
  Application,
  DBShape,
  ExtractionModel,
  NewApplicationInput,
  TagDef,
  UsageTotals,
} from '@shared/types'
import { ACCENTS } from '@shared/types'
import { JsonDb, genId } from './jsondb'

const DB_VERSION = 1

let db: JsonDb<DBShape>

const defaultData: DBShape = {
  version: DB_VERSION,
  applications: [],
  tags: [],
  usage: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 },
  settings: { extractionModel: 'claude-haiku-4-5' },
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

export async function initStore(): Promise<void> {
  db = JsonDb.open<DBShape>(dbPath(), defaultData)
  // shallow migration guard for future versions
  db.data.version = DB_VERSION
  db.data.applications ??= []
  db.data.tags ??= []
  db.data.usage ??= { calls: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 }
  db.data.settings ??= { extractionModel: 'claude-haiku-4-5' }
  await db.flushNow()
}

export async function shutdownStore(): Promise<void> {
  if (db) await db.flushNow()
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

export async function createApplication(input: NewApplicationInput): Promise<Application> {
  const id = genId(12)
  const ts = nowIso()
  const ex = input.extraction
  const application: Application = {
    id,
    url: input.url,
    sourceSite: input.sourceSite,
    company: input.company.trim(),
    roleTitle: input.roleTitle.trim(),
    location: input.location,
    workplaceType: input.workplaceType,
    employmentType: input.employmentType,
    datePosted: input.datePosted,
    salaryRange: input.salaryRange,
    jdText: input.jdText,
    dateApplied: input.dateApplied,
    status: input.status,
    accent: pickAccent(id + input.company),
    tags: dedupeTags(input.tags),
    notes: input.notes ?? '',
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
  db.data.applications.push(application)
  await registerTags(application.tags)
  await db.write()
  return application
}

const MUTABLE_FIELDS: (keyof Application)[] = [
  'company',
  'roleTitle',
  'location',
  'workplaceType',
  'employmentType',
  'datePosted',
  'salaryRange',
  'jdText',
  'dateApplied',
  'status',
  'tags',
  'notes',
  'seniority',
  'jdSummary',
  'responsibilities',
  'skills',
  'companyInsights',
  'tailoringTips',
]

export async function updateApplication(
  id: string,
  patch: Partial<Application>,
): Promise<Application | undefined> {
  const app_ = db.data.applications.find((a) => a.id === id)
  if (!app_) return undefined
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
  app_.extractionRaw = ex._raw
  app_.updatedAt = nowIso()
  await db.write()
  return app_
}

export async function deleteApplication(id: string): Promise<void> {
  db.data.applications = db.data.applications.filter((a) => a.id !== id)
  await db.write()
}

export function mutateApplication(id: string): Application | undefined {
  return db.data.applications.find((a) => a.id === id)
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

// ---------- settings + usage ----------

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
