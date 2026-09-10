import { app, BrowserWindow, ipcMain, Menu, MenuItem, shell } from 'electron'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { initStore, shutdownStore } from './store'
import { registerIpc } from './ipc'
import { scrapeUrl } from './scraper'

const isDev = !app.isPackaged

// Debug/test hooks (screenshotting, scripted eval, scrape probe, data-dir
// redirect) are dev-only. Gating them keeps arbitrary-JS and data-path overrides
// out of the shipped binary, where an attacker who could set env vars would
// otherwise get code execution in the renderer.
const SMOKE = isDev ? process.env['SMOKE'] : undefined
const SMOKE_SCRAPE = isDev ? process.env['SMOKE_SCRAPE'] : undefined
const SMOKE_HASH = isDev ? process.env['SMOKE_HASH'] : undefined
const SMOKE_EVAL = isDev ? process.env['SMOKE_EVAL'] : undefined

// --- data location safety -------------------------------------------------
// Real user data lives in the default userData dir and MUST NOT be touched by
// tests. A screenshot / scrape smoke run, or an explicit override, is sent to a
// throwaway directory so a developer can never clobber real applications.
const dataOverride =
  (isDev && process.env['JOBDASH_DATA_DIR']) ||
  (SMOKE || SMOKE_SCRAPE ? join(tmpdir(), 'job-dashboard-smoke') : '')
if (dataOverride) {
  app.setPath('userData', dataOverride)
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' as const }] : []),
      {
        label: 'File',
        submenu: [isMac ? { role: 'close' as const } : { role: 'quit' as const }],
      },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
    ]),
  )
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 940,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#141414',
    title: 'Job Dashboard',
    autoHideMenuBar: true,
    icon: isDev ? join(process.cwd(), 'build/icon.png') : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })

  // Lock the main window to its own origin. Internal routing is client-side, so
  // any real navigation is either a bug or an attempt to load a remote page into
  // the window that holds the `api` bridge — send links to the OS browser.
  const ownOrigin = (u: string): boolean =>
    u.startsWith('file://') || (!!process.env['ELECTRON_RENDERER_URL'] && isDev &&
      u.startsWith(process.env['ELECTRON_RENDERER_URL']))
  win.webContents.on('will-navigate', (e, url) => {
    if (ownOrigin(url)) return
    e.preventDefault()
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
  })
  win.webContents.on('will-frame-navigate', (e) => {
    if (!e.isMainFrame && !ownOrigin(e.url)) e.preventDefault()
  })

  // spell-check suggestions + basic edit actions on right-click
  try {
    win.webContents.session.setSpellCheckerLanguages(['en-US'])
    win.webContents.session.setSpellCheckerEnabled(true)
  } catch {
    /* platform without a spellchecker */
  }
  win.webContents.on('context-menu', (_e, params) => {
    const menu = new Menu()
    for (const s of params.dictionarySuggestions) {
      menu.append(
        new MenuItem({ label: s, click: () => win.webContents.replaceMisspelling(s) }),
      )
    }
    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length) menu.append(new MenuItem({ type: 'separator' }))
      menu.append(
        new MenuItem({
          label: `Add “${params.misspelledWord}” to dictionary`,
          click: () =>
            win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
        }),
      )
      menu.append(new MenuItem({ type: 'separator' }))
    }
    if (params.isEditable || params.selectionText) {
      if (params.isEditable) menu.append(new MenuItem({ role: 'cut', enabled: !!params.selectionText }))
      menu.append(new MenuItem({ role: 'copy', enabled: !!params.selectionText }))
      if (params.isEditable) menu.append(new MenuItem({ role: 'paste' }))
      menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ role: 'selectAll' }))
    }
    if (menu.items.length) menu.popup()
  })

  win.once('ready-to-show', () => win.show())

  const sendMax = () => win.webContents.send('win:maximized', win.isMaximized())
  win.on('maximize', sendMax)
  win.on('unmaximize', sendMax)

  if (SMOKE) {
    win.webContents.on('console-message', (_e, level, message) =>
      console.log(`  [renderer:${level}] ${message}`),
    )
    setTimeout(async () => {
      try {
        if (SMOKE_HASH) {
          const href = await win.webContents.executeJavaScript(
            `location.hash = ${JSON.stringify('#' + SMOKE_HASH)}; new Promise(r => setTimeout(() => r(location.href), 100))`,
          )
          console.log('SMOKE nav ->', href)
          await new Promise((r) => setTimeout(r, 2000))
        }
        if (SMOKE_EVAL) {
          await win.webContents.executeJavaScript(SMOKE_EVAL)
          await new Promise((r) => setTimeout(r, 700))
        }
        const img = await win.webContents.capturePage()
        const { writeFileSync } = await import('node:fs')
        writeFileSync(SMOKE, img.toPNG())
        console.log('SMOKE screenshot written')
      } catch (e) {
        console.error('SMOKE failed', e)
      }
      app.exit(0)
    }, 3500)
  }

  win.webContents.on('render-process-gone', (_e, details) =>
    console.error('[renderer] gone:', JSON.stringify(details)),
  )
  win.webContents.on('preload-error', (_e, p, err) => console.error('[preload-error]', p, err))
  if (isDev) {
    win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      if (level >= 2) console.error(`[renderer] ${message} (${sourceId}:${line})`)
    })
    win.webContents.on('did-fail-load', (_e, code, desc, url) =>
      console.error(`[renderer] did-fail-load ${code} ${desc} ${url}`),
    )
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  const hash = SMOKE_HASH ?? ''
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    void win.loadURL(devUrl + (hash ? `#${hash}` : ''))
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}

function focused(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function registerWindowIpc(): void {
  ipcMain.handle('win:minimize', () => focused()?.minimize())
  ipcMain.handle('win:toggleMaximize', () => {
    const w = focused()
    if (!w) return false
    w.isMaximized() ? w.unmaximize() : w.maximize()
    return w.isMaximized()
  })
  ipcMain.handle('win:close', () => focused()?.close())
  ipcMain.handle('win:isMaximized', () => focused()?.isMaximized() ?? false)
}

app.whenReady().then(async () => {
  await initStore()
  registerIpc()
  registerWindowIpc()
  buildMenu()

  if (SMOKE_SCRAPE) {
    try {
      const r = await scrapeUrl(SMOKE_SCRAPE)
      console.log(
        JSON.stringify(
          { ...r, jdText: r.jdText.slice(0, 300) + ` …(${r.jdText.length} chars)` },
          null,
          2,
        ),
      )
    } catch (e) {
      console.error('SCRAPE ERROR', e)
    }
    app.exit(0)
    return
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

let quitting = false
app.on('before-quit', (e) => {
  if (quitting) return
  quitting = true
  e.preventDefault()
  void shutdownStore()
    .catch(() => {})
    .finally(() => app.exit(0))
})
