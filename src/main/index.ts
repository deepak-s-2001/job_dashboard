import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { initStore, shutdownStore } from './store'
import { registerIpc } from './ipc'

const isDev = !app.isPackaged

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 940,
    minHeight: 640,
    show: false,
    backgroundColor: '#fdf6ec',
    title: 'Job Dashboard',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  if (process.env['SMOKE']) {
    win.webContents.on('console-message', (_e, level, message) =>
      console.log(`  [renderer:${level}] ${message}`),
    )
    const smokeHash = process.env['SMOKE_HASH']
    setTimeout(async () => {
      try {
        if (smokeHash) {
          const href = await win.webContents.executeJavaScript(
            `location.hash = ${JSON.stringify('#' + smokeHash)}; new Promise(r => setTimeout(() => r(location.href), 100))`,
          )
          console.log('SMOKE nav ->', href)
          await new Promise((r) => setTimeout(r, 2000))
        }
        const img = await win.webContents.capturePage()
        const { writeFileSync } = await import('node:fs')
        writeFileSync(process.env['SMOKE'] as string, img.toPNG())
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

  const hash = process.env['SMOKE_HASH'] ?? ''
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && devUrl) {
    void win.loadURL(devUrl + (hash ? `#${hash}` : ''))
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}

app.whenReady().then(async () => {
  await initStore()
  registerIpc()

  if (process.env['SMOKE_SCRAPE']) {
    const { scrapeUrl } = await import('./scraper')
    try {
      const r = await scrapeUrl(process.env['SMOKE_SCRAPE'] as string)
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
