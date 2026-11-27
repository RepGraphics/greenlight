import { contextBridge, ipcRenderer } from 'electron'
import type {DesktopBridge} from '../shared/desktopcontracts'

const trpcIpcHandler = {
  invoke(op: { path: string; type: string; input: unknown }) {
    return ipcRenderer.invoke('trpc', op)
  },
}

const desktop: DesktopBridge = {
  preferences: {
    load: () => ipcRenderer.invoke('desktop:preferences:load'),
    save: value => ipcRenderer.invoke('desktop:preferences:save', value),
  },
  accounts: {
    list: () => ipcRenderer.invoke('desktop:accounts:list'),
    start: () => ipcRenderer.invoke('desktop:accounts:start'),
    finish: () => ipcRenderer.invoke('desktop:accounts:finish'),
    open: id => ipcRenderer.invoke('desktop:accounts:open', id),
    remove: id => ipcRenderer.invoke('desktop:accounts:remove', id),
    cancel: () => ipcRenderer.invoke('desktop:accounts:cancel'),
  },
}

contextBridge.exposeInMainWorld('greenlightDesktop', desktop)
contextBridge.exposeInMainWorld('trpcIpc', trpcIpcHandler)

export type TrpcIpcHandler = typeof trpcIpcHandler
