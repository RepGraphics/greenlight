import path from 'path'
import { app, ipcMain, shell } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers/create-window'
import { setupTrpcHandler } from './trpc-handler'
import { isDeviceSignInUrl } from '../shared/devicesignin'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  setupTrpcHandler()
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isDeviceSignInUrl(url)) void shell.openExternal(url).catch(() => {})
    return { action: 'deny' }
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})
