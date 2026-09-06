// Canonical IPC channel names, shared by main (ipcMain.handle) and preload (ipcRenderer.invoke).

export const IPC = {
  // applications
  appsList: 'apps:list',
  appGet: 'apps:get',
  appCreate: 'apps:create',
  appUpdate: 'apps:update',
  appDelete: 'apps:delete',

  // scrape + extract
  scrapeUrl: 'scrape:url',
  extractJd: 'extract:jd',

  // resumes
  resumeAttach: 'resume:attach',
  resumeRemove: 'resume:remove',
  resumeSetPrimary: 'resume:setPrimary',
  resumeReadData: 'resume:readData',
  resumeOpenExternal: 'resume:openExternal',

  // tags
  tagsList: 'tags:list',
  tagsUpsert: 'tags:upsert',
  tagsDelete: 'tags:delete',

  // settings / secrets / misc
  settingsGet: 'settings:get',
  settingsSetModel: 'settings:setModel',
  apiKeyStatus: 'apiKey:status',
  apiKeySet: 'apiKey:set',
  apiKeyTest: 'apiKey:test',
  usageGet: 'usage:get',
  linkedinLogin: 'linkedin:login',
  openDataFolder: 'data:openFolder',
  exportAll: 'data:exportAll',
  backupsList: 'data:backupsList',
  backupRestore: 'data:backupRestore',
  appVersion: 'app:version',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
