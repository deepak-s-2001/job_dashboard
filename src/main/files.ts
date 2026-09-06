import { shell } from 'electron'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { Resume } from '@shared/types'
import { resumesDir, mutateApplication, persist } from './store'
import { genId } from './jsondb'

function appResumeDir(appId: string): string {
  const dir = join(resumesDir(), appId)
  mkdirSync(dir, { recursive: true })
  return dir
}

export async function attachResume(
  appId: string,
  sourcePath: string,
): Promise<{ ok: boolean; error?: string; resume?: Resume }> {
  const app_ = mutateApplication(appId)
  if (!app_) return { ok: false, error: 'Application not found.' }
  if (!existsSync(sourcePath)) return { ok: false, error: 'That file no longer exists.' }
  if (extname(sourcePath).toLowerCase() !== '.pdf') {
    return { ok: false, error: 'Only PDF resumes are supported.' }
  }

  let bytes: Buffer
  try {
    bytes = readFileSync(sourcePath)
  } catch {
    return { ok: false, error: 'Could not read that file.' }
  }
  const hash = createHash('sha256').update(bytes).digest('hex')
  if (app_.resumes.some((r) => r.hash === hash)) {
    return { ok: false, error: 'That exact resume is already attached to this job.' }
  }

  const id = genId(10)
  const stored = join(appResumeDir(appId), `${id}.pdf`)
  try {
    copyFileSync(sourcePath, stored)
  } catch (err) {
    return { ok: false, error: `Could not copy the file: ${(err as Error).message}` }
  }

  const resume: Resume = {
    id,
    filename: basename(sourcePath),
    storedPath: stored,
    hash,
    isPrimary: app_.resumes.length === 0,
    addedAt: new Date().toISOString(),
  }
  app_.resumes.push(resume)
  app_.updatedAt = new Date().toISOString()
  await persist()
  return { ok: true, resume }
}

export async function removeResume(
  appId: string,
  resumeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const app_ = mutateApplication(appId)
  if (!app_) return { ok: false, error: 'Application not found.' }
  const idx = app_.resumes.findIndex((r) => r.id === resumeId)
  if (idx === -1) return { ok: false, error: 'Resume not found.' }
  const [removed] = app_.resumes.splice(idx, 1)
  try {
    if (existsSync(removed.storedPath)) rmSync(removed.storedPath)
  } catch {
    /* file already gone — fine */
  }
  if (removed.isPrimary && app_.resumes.length > 0) {
    app_.resumes[0].isPrimary = true
  }
  app_.updatedAt = new Date().toISOString()
  await persist()
  return { ok: true }
}

export async function setPrimaryResume(
  appId: string,
  resumeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const app_ = mutateApplication(appId)
  if (!app_) return { ok: false, error: 'Application not found.' }
  if (!app_.resumes.some((r) => r.id === resumeId)) {
    return { ok: false, error: 'Resume not found.' }
  }
  for (const r of app_.resumes) r.isPrimary = r.id === resumeId
  app_.updatedAt = new Date().toISOString()
  await persist()
  return { ok: true }
}

export function readResumeData(
  appId: string,
  resumeId: string,
): { ok: boolean; error?: string; data?: Buffer; filename?: string } {
  const app_ = mutateApplication(appId)
  const resume = app_?.resumes.find((r) => r.id === resumeId)
  if (!resume) return { ok: false, error: 'Resume not found.' }
  if (!existsSync(resume.storedPath)) {
    return { ok: false, error: 'The stored PDF is missing from disk.' }
  }
  try {
    return { ok: true, data: readFileSync(resume.storedPath), filename: resume.filename }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

export async function openResumeExternal(
  appId: string,
  resumeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const app_ = mutateApplication(appId)
  const resume = app_?.resumes.find((r) => r.id === resumeId)
  if (!resume) return { ok: false, error: 'Resume not found.' }
  const err = await shell.openPath(resume.storedPath)
  return err ? { ok: false, error: err } : { ok: true }
}

export function deleteAppResumes(appId: string): void {
  try {
    rmSync(join(resumesDir(), appId), { recursive: true, force: true })
  } catch {
    /* nothing to clean */
  }
}
