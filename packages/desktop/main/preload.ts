import { contextBridge, ipcRenderer, shell } from 'electron'
import pkg from '../package.json'

let nextRequestId = 0

export const Preload = {

    send(channel:string, action:string, data = {}){
        return new Promise((resolve, reject) => {
            const requestId = ++nextRequestId
            const callbackFunction = (_event, args) => {
                if (args.action !== action || args.id !== requestId) return
                clearTimeout(timeout)
                ipcRenderer.removeListener(channel, callbackFunction)
                if (args.error === undefined) resolve(args.data)
                else reject(args.error)
            }
            const timeout = setTimeout(() => {
                ipcRenderer.removeListener(channel, callbackFunction)
                reject(new Error('Application request timed out'))
            }, 60000)
            ipcRenderer.on(channel, callbackFunction)
            try {
                ipcRenderer.send(channel, { id: requestId, action, data })
            } catch (error) {
                clearTimeout(timeout)
                ipcRenderer.removeListener(channel, callbackFunction)
                reject(error)
            }
        })
    },

    on(channel:string, listener){

        const wrapEvent = (event, args) => {
            listener(event, args.action, args.data)
        }

        ipcRenderer.on(channel, wrapEvent)

        return wrapEvent
    }, 

    onAction(channel:string, action:string, listener){

        const wrapEvent = (event, args) => {
            if(args.action === action){
                listener(event, args.data)
            }
        }

        ipcRenderer.on(channel, wrapEvent)

        return wrapEvent
    },

    removeListener(channel:string, listener){
        ipcRenderer.removeListener(channel, listener)
    },

    openExternal(url:string){
        try {
            const parsed = new URL(url)
            if (parsed.protocol === 'https:' || parsed.protocol === 'http:') void shell.openExternal(parsed.href)
        } catch { /* Ignore invalid external links. */ }
    },

    getVersion(){
        return pkg.version
    },

    isWebUI(){
        return false
    },
}

contextBridge.exposeInMainWorld('Greenlight', Preload)