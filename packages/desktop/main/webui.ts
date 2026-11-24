import Application from './application'
import express from 'express'
import expressWS from 'express-ws'
import expressProxy from 'express-http-proxy'
import path from 'path'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import Ipc from './ipc'
import defaultSettings from '../shared/settings-defaults.json'

export default class WebUI {
    _application:Application
    _express:express
    _ws:expressWS
    _ipc:Ipc
    _server
    private accessToken = randomBytes(32).toString('hex')

    getAccessToken() { return this.accessToken }

    private authorized(req) {
        const header = req.headers.authorization || ''
        if (!header.startsWith('Basic ')) return false
        const credential = Buffer.from(header.slice(6), 'base64').toString('utf8')
        const expected = Buffer.from('greenlight:' + this.accessToken)
        const actual = Buffer.from(credential)
        return expected.length === actual.length && timingSafeEqual(expected, actual)
    }

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
        if (this._server) return
        port = Number(port)
        if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid WebUI port')
        this.accessToken = randomBytes(32).toString('hex')
        this._application.log('webui', 'Starting webserver...')
        this._express = express()
        this._ws = expressWS(this._express)
        this._ipc = this._application._ipc

        // this._application._events.on('start', () => {
        //     this._ipc.onUserLoaded()
        // })

        this._express.use((req, res, next) => {
            res.setHeader('Cache-Control', 'no-store')
            res.setHeader('X-Content-Type-Options', 'nosniff')
            res.setHeader('Referrer-Policy', 'no-referrer')
            if (!this.authorized(req)) {
                res.setHeader('WWW-Authenticate', 'Basic realm="Greenlight WebUI", charset="UTF-8"')
                res.status(401).send('Authentication required')
                return
            }
            next()
        })

        this._express.get('/', (req, res) => {
            // res.send('Hello World!')
            // res.sendFile(path.join(__dirname, "../app/", "home.html"));
            res.redirect('/home')
        })

        this._express.ws('/ipc', (ws, req) => {
            // WebUI is local-only until an authenticated remote-access design exists.
            const origins = ['http://' + req.headers.host, 'https://' + req.headers.host]
            if (!this.authorized(req) || !origins.includes(req.headers.origin || '')) {
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
        this._server.on('error', () => {
            this._application.log('webui', 'Unable to bind WebUI port')
            this._server = undefined
            this._express = undefined
        })
    }

    stopServer(){
        this._application.log('webui', 'Stopping webserver...')
        if(this._express){
            this._ws.getWss().clients.forEach(client => client.close(1001, 'Server stopped'))
            this._server?.close()
            this._server = undefined
            this.accessToken = randomBytes(32).toString('hex')
            delete this._express
        }
    }
}