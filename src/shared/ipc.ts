// Canonical IPC channel names, shared by main (ipcMain.handle) and preload (ipcRenderer.invoke).

export const IPC = {
  // applications
  appsList: 'apps:list',
  appGet: 'apps:get',
  appCreate: 'apps:create',
  appCreateBulk: 'apps:createBulk',
  appUpdate: 'apps:update',
  appBulkArchive: 'apps:bulkArchive',
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

  // contacts / network
  contactsList: 'contacts:list',
  contactGet: 'contacts:get',
  contactCreate: 'contacts:create',
  contactUpdate: 'contacts:update',
  contactDelete: 'contacts:delete',

  // to-dos
  todosList: 'todos:list',
  todoCreate: 'todos:create',
  todoUpdate: 'todos:update',
  todoDelete: 'todos:delete',

  // settings / secrets / misc
  settingsGet: 'settings:get',
  settingsSetModel: 'settings:setModel',
  settingsSetProfile: 'settings:setProfile',
  openExternal: 'system:openExternal',
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
