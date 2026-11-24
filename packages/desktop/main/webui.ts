import Application from './application'
import express from 'express'
import expressWS from 'express-ws'
import expressProxy from 'express-http-proxy'
import path from 'path'
import Ipc from './ipc'
import { defaultSettings } from '../renderer/context/userContext.defaults'

export default class WebUI {
    _application:Application
    _express:express
    _ws:expressWS
    _ipc:Ipc
    _server

    constructor(application:Application){
        this._application = application
        this._application.log('webui', 'Loaded WebUI Plugin')

        const rawSettings = this._application._store.get('settings', defaultSettings) as object
        const settings = {...defaultSettings, ...rawSettings}

        // this._application.log('webui', 'Settings:', settings, rawSettings)

        if(settings.webui_autostart === true){
            this.startServer(settings.webui_port)
        } else {
            this._application._store.set('settings', {...settings, webui_enabled: false})
        }
    }

    startServer(port:number = 3000){
        this._application.log('webui', 'Starting webserver...')
        this._express = express()
        this._ws = expressWS(this._express)
        this._ipc = this._application._ipc

        // this._application._events.on('start', () => {
        //     this._ipc.onUserLoaded()
        // })

        this._express.get('/', (req, res) => {
            // res.send('Hello World!')
            // res.sendFile(path.join(__dirname, "../app/", "home.html"));
            res.redirect('/home')
        })

        this._express.ws('/ipc', (ws, req) => {
            // WebUI is local-only until an authenticated remote-access design exists.
            const expectedOrigin = 'http://' + req.headers.host
            if (req.headers.origin !== expectedOrigin) {
                ws.close(1008, 'Origin not allowed')
                return
            }
            ws.on('message', (msg) => {
                try {
                    if (Buffer.byteLength(msg.toString()) > 1024 * 1024) return
                    const request = JSON.parse(msg.toString())
                    if (!request || typeof request.channel !== 'string' || typeof request.action !== 'string' || !Number.isSafeInteger(request.id)) return
                    if (!Object.prototype.hasOwnProperty.call(this._ipc._channels, request.channel)) return
                    const denied = request.channel === 'app' && ['quit', 'restart', 'clearData', 'login', 'setForceRegionIp', 'setPreferredGameLanguage', 'debug'].includes(request.action)
                        || request.channel === 'settings' && request.action !== 'getSettings' && request.action !== 'getWebUIStatus'
                    const reply = (response) => {
                        if (ws.readyState === 1) ws.send(JSON.stringify({ channel: request.channel, ...response }))
                    }
                    if (denied) {
                        reply({ action: request.action, id: request.id, data: {}, error: { message: 'This action is available only in the desktop app' } })
                        return
                    }
                    void this._ipc._channels[request.channel].onEvent(request.channel, undefined, request, reply)
                } catch {
                    // Ignore malformed client messages.
                }
            })
        })

        if(this._application._isProduction){
            this._express.use(express.static(path.join(__dirname, '../app/')))

            this._express.get(/.*/, (req, res) => {
                // res.send('Hello World!')
                res.sendFile(path.join(__dirname, '../app/', 'home.html'))
            })
        } else {
            this._express.use(expressProxy('localhost', { port: 8888}))
        }


        this._server = this._express.listen(port, '127.0.0.1', () => {
            this._application.log('webui', 'Webserver running on port:', port)
            console.log(`Webserver started on port: ${port}`)
        })
    }

    stopServer(){
        this._application.log('webui', 'Stopping webserver...')
        if(this._express){
            this._ws.getWss().clients.forEach(client => client.close(1001, 'Server stopped'))
            this._server.close()
            delete this._express
        }
    }
}