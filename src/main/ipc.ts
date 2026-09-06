import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import { cpSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '@shared/ipc'
import type {
  ApiResult,
  Application,
  ExtractionModel,
  NewApplicationInput,
  TagDef,
} from '@shared/types'
import {
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
  applyExtraction,
  listTags,
  upsertTag,
  deleteTag,
  getModel,
  setModel,
  getUsage,
  dataDir,
} from './store'
import { getApiKey, setApiKey, hasApiKey, clearApiKey } from './secrets'
import { extractJd, testApiKey, ExtractionError } from './extract'
import { scrapeUrl, scrapeFromText, openLoginWindow } from './scraper'
import {
  attachResume,
  removeResume,
  setPrimaryResume,
  readResumeData,
  openResumeExternal,
  deleteAppResumes,
} from './files'

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data }
}
function fail<T = never>(error: string): ApiResult<T> {
  return { ok: false, error }
}

async function guard<T>(fn: () => Promise<T> | T): Promise<ApiResult<T>> {
  try {
    return ok(await fn())
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return fail(msg)
  }
}

export function registerIpc(): void {
  // ---------- applications ----------
  ipcMain.handle(IPC.appsList, () => ok(listApplications()))

  ipcMain.handle(IPC.appGet, (_e, id: string) => {
    const a = getApplication(id)
    return a ? ok(a) : fail<Application>('Application not found.')
  })

  ipcMain.handle(IPC.appCreate, (_e, input: NewApplicationInput) =>
    guard(() => createApplication(input)),
  )

  ipcMain.handle(IPC.appUpdate, (_e, id: string, patch: Partial<Application>) =>
    guard(async () => {
      const updated = await updateApplication(id, patch)
      if (!updated) throw new Error('Application not found.')
      return updated
    }),
  )

  ipcMain.handle(IPC.appDelete, (_e, id: string) =>
    guard(async () => {
      await deleteApplication(id)
      deleteAppResumes(id)
      return true
    }),
  )

  // ---------- scrape + extract ----------
  ipcMain.handle(IPC.scrapeUrl, (_e, url: string, pastedText?: string) =>
    guard(() =>
      pastedText && pastedText.trim()
        ? scrapeFromText(url, pastedText)
        : scrapeUrl(url),
    ),
  )

  ipcMain.handle(
    IPC.extractJd,
    (
      _e,
      args: { company: string; roleTitle: string; jdText: string; applicationId?: string },
    ) =>
      guard(async () => {
        if (!hasApiKey()) {
          throw new ExtractionError('Add your Anthropic API key in Settings first.')
        }
        const result = await extractJd({
          company: args.company,
          roleTitle: args.roleTitle,
          jdText: args.jdText,
        })
        if (args.applicationId) {
          await applyExtraction(args.applicationId, result)
        }
        return result
      }),
  )

  // ---------- resumes ----------
  ipcMain.handle(IPC.resumeAttach, async (_e, appId: string, providedPath?: string) => {
    let sourcePath = providedPath
    if (!sourcePath) {
      const res = await dialog.showOpenDialog({
        title: 'Choose the resume PDF for this job',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
        properties: ['openFile'],
      })
      if (res.canceled || !res.filePaths[0]) return fail('No file chosen.')
      sourcePath = res.filePaths[0]
    }
    const r = await attachResume(appId, sourcePath)
    return r.ok ? ok(r.resume) : fail(r.error ?? 'Could not attach the resume.')
  })

  ipcMain.handle(IPC.resumeRemove, async (_e, appId: string, resumeId: string) => {
    const r = await removeResume(appId, resumeId)
    return r.ok ? ok(true) : fail(r.error ?? 'Could not remove the resume.')
  })

  ipcMain.handle(IPC.resumeSetPrimary, async (_e, appId: string, resumeId: string) => {
    const r = await setPrimaryResume(appId, resumeId)
    return r.ok ? ok(true) : fail(r.error ?? 'Could not set the primary resume.')
  })

  ipcMain.handle(IPC.resumeReadData, (_e, appId: string, resumeId: string) => {
    const r = readResumeData(appId, resumeId)
    return r.ok ? ok({ data: r.data, filename: r.filename }) : fail(r.error ?? 'Read failed.')
  })

  ipcMain.handle(IPC.resumeOpenExternal, async (_e, appId: string, resumeId: string) => {
    const r = await openResumeExternal(appId, resumeId)
    return r.ok ? ok(true) : fail(r.error ?? 'Could not open the file.')
  })

  // ---------- tags ----------
  ipcMain.handle(IPC.tagsList, () => ok(listTags()))
  ipcMain.handle(IPC.tagsUpsert, (_e, tag: TagDef) => guard(() => upsertTag(tag)))
  ipcMain.handle(IPC.tagsDelete, (_e, name: string) => guard(() => deleteTag(name)))

  // ---------- settings / secrets / misc ----------
  ipcMain.handle(IPC.settingsGet, () =>
    ok({ extractionModel: getModel(), hasApiKey: hasApiKey() }),
  )
  ipcMain.handle(IPC.settingsSetModel, (_e, model: ExtractionModel) =>
    guard(() => setModel(model)),
  )
  ipcMain.handle(IPC.apiKeyStatus, () => ok(hasApiKey()))
  ipcMain.handle(IPC.apiKeySet, (_e, key: string) =>
    guard(() => {
      if (!key || !key.trim()) clearApiKey()
      else setApiKey(key)
      return hasApiKey()
    }),
  )
  ipcMain.handle(IPC.apiKeyTest, async (_e, key?: string) => {
    const toTest = key && key.trim() ? key : getApiKey()
    if (!toTest) return fail('No API key to test.')
    const r = await testApiKey(toTest)
    return r.ok ? ok(true) : fail(r.error ?? 'Key test failed.')
  })
  ipcMain.handle(IPC.usageGet, () => ok(getUsage()))

  ipcMain.handle(IPC.linkedinLogin, () => {
    openLoginWindow('https://www.linkedin.com/login')
    return ok(true)
  })

  ipcMain.handle(IPC.openDataFolder, async () => {
    await shell.openPath(dataDir())
    return ok(true)
  })

  ipcMain.handle(IPC.exportAll, async () => {
    const win = BrowserWindow.getFocusedWindow() ?? undefined
    const res = await dialog.showOpenDialog(win!, {
      title: 'Choose a folder for the backup',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (res.canceled || !res.filePaths[0]) return fail('Export cancelled.')
    const stamp = new Date().toISOString().slice(0, 10)
    const dest = join(res.filePaths[0], `job-dashboard-backup-${stamp}`)
    try {
      cpSync(join(dataDir(), 'db.json'), join(dest, 'db.json'))
      const resumesSrc = join(dataDir(), 'resumes')
      if (existsSync(resumesSrc)) cpSync(resumesSrc, join(dest, 'resumes'), { recursive: true })
      await shell.openPath(dest)
      return ok(dest)
    } catch (err) {
      return fail(`Export failed: ${(err as Error).message}`)
    }
  })

  ipcMain.handle(IPC.appVersion, () => ok(app.getVersion()))
}
