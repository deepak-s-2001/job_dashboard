import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  ApiResult,
  Application,
  ExtractionModel,
  ExtractionResult,
  NewApplicationInput,
  Resume,
  ScrapedJob,
  Settings,
  TagDef,
  UsageTotals,
} from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<ApiResult<T>> =>
  ipcRenderer.invoke(channel, ...args)

const api = {
  apps: {
    list: () => invoke<Application[]>(IPC.appsList),
    get: (id: string) => invoke<Application>(IPC.appGet, id),
    create: (input: NewApplicationInput) => invoke<Application>(IPC.appCreate, input),
    update: (id: string, patch: Partial<Application>) =>
      invoke<Application>(IPC.appUpdate, id, patch),
    remove: (id: string) => invoke<boolean>(IPC.appDelete, id),
  },
  scrape: {
    url: (url: string, pastedText?: string) =>
      invoke<ScrapedJob>(IPC.scrapeUrl, url, pastedText),
  },
  extract: {
    jd: (args: {
      company: string
      roleTitle: string
      jdText: string
      applicationId?: string
    }) => invoke<ExtractionResult>(IPC.extractJd, args),
  },
  resumes: {
    attach: (appId: string, path?: string) => invoke<Resume>(IPC.resumeAttach, appId, path),
    remove: (appId: string, resumeId: string) =>
      invoke<boolean>(IPC.resumeRemove, appId, resumeId),
    setPrimary: (appId: string, resumeId: string) =>
      invoke<boolean>(IPC.resumeSetPrimary, appId, resumeId),
    readData: (appId: string, resumeId: string) =>
      invoke<{ data: Uint8Array; filename: string }>(IPC.resumeReadData, appId, resumeId),
    openExternal: (appId: string, resumeId: string) =>
      invoke<boolean>(IPC.resumeOpenExternal, appId, resumeId),
  },
  tags: {
    list: () => invoke<TagDef[]>(IPC.tagsList),
    upsert: (tag: TagDef) => invoke<void>(IPC.tagsUpsert, tag),
    remove: (name: string) => invoke<void>(IPC.tagsDelete, name),
  },
  settings: {
    get: () => invoke<Settings>(IPC.settingsGet),
    setModel: (model: ExtractionModel) => invoke<void>(IPC.settingsSetModel, model),
  },
  apiKey: {
    status: () => invoke<boolean>(IPC.apiKeyStatus),
    set: (key: string) => invoke<boolean>(IPC.apiKeySet, key),
    test: (key?: string) => invoke<boolean>(IPC.apiKeyTest, key),
  },
  usage: {
    get: () => invoke<UsageTotals>(IPC.usageGet),
  },
  system: {
    linkedinLogin: () => invoke<boolean>(IPC.linkedinLogin),
    openDataFolder: () => invoke<boolean>(IPC.openDataFolder),
    exportAll: () => invoke<string>(IPC.exportAll),
    version: () => invoke<string>(IPC.appVersion),
    /** absolute path of a dropped/selected File (Electron webUtils) */
    pathForFile: (file: File) => webUtils.getPathForFile(file),
  },
}

export type JobDashboardApi = typeof api

contextBridge.exposeInMainWorld('api', api)
