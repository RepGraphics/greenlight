import type Application from '../application'
import type xCloudApi from './xcloudapi'
import type { playResult } from './xcloudapi'

interface streamSession {
    id: string;
    target: string;
    path: string;
    type: string|'home'|'cloud';
    state?: string;
    waitingTimes?: any;
    playerState: string|'pending'|'started'|'queued'|'failed';
    errorDetails?: {
        code;
        message;
    };
}

export default class StreamManager {

    _application:Application

    _sessions:Record<string,streamSession> = Object.create(null)
    private monitorFailures = new Map<string, number>()
    private monitorTimers = new Map<string, ReturnType<typeof setTimeout>>()
    private monitorInFlight = new Set<string>()
    private stopping = new Map<string, Promise<unknown>>()
    
    constructor(application, private schedule:typeof setTimeout=setTimeout, private cancel:typeof clearTimeout=clearTimeout){
        this._application = application
    }

    getApi(type):xCloudApi{
        if(type === 'home'){
            return this._application._xHomeApi
        } else {
            return this._application._xCloudApi
        }
    }

    getSession(sessionId:string):streamSession {
        return typeof sessionId==='string'&&Object.prototype.hasOwnProperty.call(this._sessions,sessionId)?this._sessions[sessionId]:undefined
    }

    startStream(type:string|'home'|'cloud', target, resolution: 720 | 1080 = 1080){
        return new Promise((resolve, reject) => {
            const api = this.getApi(type)
            if (!api || !target || (type !== 'home' && type !== 'cloud')) return reject(new Error('Invalid streaming target'))
            api.startStream(target, resolution).then((playResult:playResult) => {
            // this._application._xCloudApi.startStream(type, target).then((playResult) => {
                console.log('Streammanager - startStream:', playResult)

                const sessionId = playResult?.sessionPath?.split('/')[3]
                if (!sessionId || ['__proto__','constructor','prototype'].includes(sessionId)) throw new Error('Invalid streaming session response')

                const streamSession:streamSession = {
                    id: sessionId,
                    target: target,
                    path: playResult.sessionPath,
                    type: type,
                    playerState: 'pending',
                }
                if(this.getSession(sessionId))throw new Error('Duplicate streaming session identifier')
                this._sessions[sessionId] = streamSession
                this.monitorSession(sessionId)

                resolve(sessionId)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    stopStream(sessionId:string):Promise<unknown>{
        const pending=this.stopping.get(sessionId)
        if(pending)return pending
        const session=this.getSession(sessionId)
        if(!session)return Promise.resolve(true)
        const timer=this.monitorTimers.get(sessionId)
        if(timer!==undefined)this.cancel(timer)
        this.monitorTimers.delete(sessionId)
        const operation=Promise.resolve().then(()=>this.getApi(session.type).stopStream(sessionId)).then(result=>{
            if(this.getSession(sessionId)===session){delete this._sessions[sessionId];this.monitorFailures.delete(sessionId)}
            return result
        }).finally(()=>{
            this.stopping.delete(sessionId)
            if(this.getSession(sessionId)===session)this.monitorSession(sessionId)
        })
        this.stopping.set(sessionId,operation)
        return operation
    }

    sendSdp(sessionId:string, sdp:any){
        return new Promise((resolve, reject) => {
            const session = this.getSession(sessionId)
            if(session === undefined){
                reject('Session not found: '+sessionId)
                return
            }

            this.getApi(session.type).sendSdp(sessionId, sdp).then((result) => {

                resolve(result)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    sendChatSdp(sessionId:string, sdp:any){
        return new Promise((resolve, reject) => {
            const session = this.getSession(sessionId)
            if(session === undefined){
                reject('Session not found: '+sessionId)
                return
            }

            this.getApi(session.type).sendChatSdp(sessionId, sdp).then((result) => {

                resolve(result)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    sendIce(sessionId:string, ice:any){
        return new Promise((resolve, reject) => {
            const session = this.getSession(sessionId)
            if(session === undefined){
                reject('Session not found: '+sessionId)
                return
            }

            this.getApi(session.type).sendIce(sessionId, ice).then((result) => {

                resolve(result)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    sendKeepalive(sessionId:string){
        return new Promise((resolve, reject) => {
            const session = this.getSession(sessionId)
            if(session === undefined){
                reject('Session not found: '+sessionId)
                return
            }

            this.getApi(session.type).sendKeepalive(sessionId).then((result) => {
                resolve(result)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    monitorSession(sessionId: string) {
        if(this.monitorTimers.has(sessionId)||this.monitorInFlight.has(sessionId)||this.stopping.has(sessionId))return
        const initial=this.getSession(sessionId)
        if(!initial||initial.playerState==='failed'||initial.playerState==='started')return
        const timer=this.schedule(async () => {
            this.monitorTimers.delete(sessionId)
            if(this.stopping.has(sessionId))return
            const session = this.getSession(sessionId)
            if (!session || session!==initial || session.playerState === 'failed' || session.playerState === 'started') return
            this.monitorInFlight.add(sessionId)
            const fail = (code: string, message: string) => {
                if (this.getSession(sessionId) !== session || this.stopping.has(sessionId)) return
                session.errorDetails = { code, message }
                session.playerState = 'failed'
                this.monitorFailures.delete(sessionId)
            }
            try {
                const api = this.getApi(session.type)
                const result: any = await api.getStreamState(sessionId)
                if (this.getSession(sessionId) !== session || this.stopping.has(sessionId)) return
                session.state = result.state
                if (result.state === 'Provisioned') {
                    session.playerState = 'started'
                    this.monitorFailures.delete(sessionId)
                    return
                }
                if (result.state === 'Failed') {
                    fail(result.errorDetails?.code || 'StreamFailed', result.errorDetails?.message || 'Stream provisioning failed')
                    return
                }
                if (result.state === 'ReadyToConnect') {
                    const token = await this._application._authentication._msal.getMsalToken()
                    if (this.getSession(sessionId) !== session || this.stopping.has(sessionId)) return
                    await api.sendMSALAuth(sessionId, token.data.lpt)
                } else if (result.state === 'WaitingForResources') {
                    session.playerState = 'queued'
                    if (!session.waitingTimes) {
                        try {
                            const waitingTimes = await api.getWaitingTimes(session.target)
                            if (this.getSession(sessionId) !== session || this.stopping.has(sessionId)) return
                            session.waitingTimes = waitingTimes
                        } catch {
                            // Queue estimates are optional; continue monitoring the stream.
                        }
                    }
                }
                this.monitorFailures.delete(sessionId)
            } catch (error) {
                if (this.getSession(sessionId) !== session || this.stopping.has(sessionId)) return
                const failures = (this.monitorFailures.get(sessionId) || 0) + 1
                this.monitorFailures.set(sessionId, failures)
                if (error?.status === 404 || failures >= 5) {
                    fail('StreamStateUnavailable', 'Unable to retrieve the streaming session. Please reconnect.')
                    return
                }
            } finally {
                this.monitorInFlight.delete(sessionId)
                if (this.getSession(sessionId) === session) this.monitorSession(sessionId)
            }
        }, 1000)
        this.monitorTimers.set(sessionId,timer)
    }

    getActiveSessions(){
        return new Promise((resolve, reject) => {
            this.getApi('cloud').getActiveSessions().then((result) => {

                console.log('Active sessions:', result)
                resolve(result)
            }).catch((error) => {
                reject(error)
            })
        })
    }
}