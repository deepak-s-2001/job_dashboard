import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  ApiResult,
  Application,
  Contact,
  ExtractionModel,
  ExtractionResult,
  NewApplicationInput,
  NewContactInput,
  NewTodoInput,
  Resume,
  ScrapedJob,
  Settings,
  TagDef,
  Todo,
  UsageTotals,
  UserProfile,
} from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<ApiResult<T>> =>
  ipcRenderer.invoke(channel, ...args)

const api = {
  apps: {
    list: () => invoke<Application[]>(IPC.appsList),
    get: (id: string) => invoke<Application>(IPC.appGet, id),
    create: (input: NewApplicationInput) => invoke<Application>(IPC.appCreate, input),
    createBulk: (inputs: NewApplicationInput[]) =>
      invoke<Application[]>(IPC.appCreateBulk, inputs),
    update: (id: string, patch: Partial<Application>) =>
      invoke<Application>(IPC.appUpdate, id, patch),
    bulkArchive: (ids: string[], archived: boolean) =>
      invoke<number>(IPC.appBulkArchive, ids, archived),
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
  contacts: {
    list: () => invoke<Contact[]>(IPC.contactsList),
    get: (id: string) => invoke<Contact>(IPC.contactGet, id),
    create: (input: NewContactInput) => invoke<Contact>(IPC.contactCreate, input),
    update: (id: string, patch: Partial<Contact>) =>
      invoke<Contact>(IPC.contactUpdate, id, patch),
    remove: (id: string) => invoke<boolean>(IPC.contactDelete, id),
  },
  todos: {
    list: () => invoke<Todo[]>(IPC.todosList),
    create: (input: NewTodoInput) => invoke<Todo>(IPC.todoCreate, input),
    update: (id: string, patch: Partial<Todo>) => invoke<Todo>(IPC.todoUpdate, id, patch),
    remove: (id: string) => invoke<boolean>(IPC.todoDelete, id),
  },
  settings: {
    get: () => invoke<Settings>(IPC.settingsGet),
    setModel: (model: ExtractionModel) => invoke<void>(IPC.settingsSetModel, model),
    setProfile: (p: UserProfile) => invoke<void>(IPC.settingsSetProfile, p),
  },
  apiKey: {
    status: () => invoke<boolean>(IPC.apiKeyStatus),
    set: (key: string) => invoke<boolean>(IPC.apiKeySet, key),
    test: (key?: string) => invoke<boolean>(IPC.apiKeyTest, key),
  },
  usage: {
    get: () => invoke<UsageTotals>(IPC.usageGet),
  },
  win: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('win:toggleMaximize') as Promise<boolean>,
    close: () => ipcRenderer.invoke('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:isMaximized') as Promise<boolean>,
    onMaximizedChange: (cb: (maximized: boolean) => void): (() => void) => {
      const listener = (_e: unknown, v: boolean) => cb(v)
      ipcRenderer.on('win:maximized', listener)
      return () => {
        ipcRenderer.removeListener('win:maximized', listener)
      }
    },
  },
  system: {
    linkedinLogin: () => invoke<boolean>(IPC.linkedinLogin),
    openDataFolder: () => invoke<boolean>(IPC.openDataFolder),
    exportAll: () => invoke<string>(IPC.exportAll),
    backupsList: () =>
      invoke<{ name: string; savedAt: string; label: string; applications: number }[]>(
        IPC.backupsList,
      ),
    backupRestore: (name: string) => invoke<number>(IPC.backupRestore, name),
    openExternal: (url: string) => invoke<boolean>(IPC.openExternal, url),
    version: () => invoke<string>(IPC.appVersion),
    /** absolute path of a dropped/selected File (Electron webUtils) */
    pathForFile: (file: File) => webUtils.getPathForFile(file),
  },
}

export type JobDashboardApi = typeof api

contextBridge.exposeInMainWorld('api', api)
