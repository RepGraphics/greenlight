import path from 'path'
import { app, shell, type IpcMainInvokeEvent } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers/create-window'
import { setupTrpcHandler } from './trpc-handler'
import { setupDesktopServices } from './desktop-services'
import { isDeviceSignInUrl } from '../shared/devicesignin'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

async function start() {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    title: 'Greenlight V3',
    backgroundColor: '#0e1713',
    autoHideMenuBar: true,
    icon: isProd ? path.join(import.meta.dirname, 'images', 'logo.png') : undefined,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.js'),
    },
  })

  const port = process.argv[2]
  const isAppUrl = (value: string) => {
    try {
      const url = new URL(value)
      return isProd ? url.protocol === 'app:' && url.host === '.'
        : url.origin === `http://localhost:${port}`
    } catch {return false}
  }
  const trusted = (event: IpcMainInvokeEvent) => event.sender === mainWindow.webContents
    && event.senderFrame !== null && event.senderFrame === mainWindow.webContents.mainFrame
    && isAppUrl(event.senderFrame.url)
  const accounts = setupDesktopServices(trusted)
  setupTrpcHandler(trusted, (type, token) => accounts.streamRefreshToken(type, token))
  mainWindow.webContents.on('will-navigate', (event, url) => {if (!isAppUrl(url)) event.preventDefault()})

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isDeviceSignInUrl(url)) void shell.openExternal(url).catch(() => {})
    return { action: 'deny' }
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }
  app.on('second-instance', () => {
    if (mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

if (app.requestSingleInstanceLock()) {
  void start().catch(() => {
    console.error('Could not start the Greenlight V3 window.')
    app.quit()
  })
} else {
  app.quit()
}

app.on('window-all-closed', () => {
  app.quit()
})
