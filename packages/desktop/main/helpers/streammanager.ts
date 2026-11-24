import Application from '../application'
import xCloudApi, { playResult } from './xcloudapi'

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

    _sessions = {}
    private monitorFailures = new Map<string, number>()
    
    constructor(application){
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
        return this._sessions[sessionId]
    }

    startStream(type:string|'home'|'cloud', target, resolution: 720 | 1080 = 1080){
        return new Promise((resolve, reject) => {
            const api = this.getApi(type)
            if (!api || !target || (type !== 'home' && type !== 'cloud')) return reject(new Error('Invalid streaming target'))
            api.startStream(target, resolution).then((playResult:playResult) => {
            // this._application._xCloudApi.startStream(type, target).then((playResult) => {
                console.log('Streammanager - startStream:', playResult)

                const sessionId = playResult?.sessionPath?.split('/')[3]
                if (!sessionId) throw new Error('Invalid streaming session response')

                const streamSession:streamSession = {
                    id: sessionId,
                    target: target,
                    path: playResult.sessionPath,
                    type: type,
                    playerState: 'pending',
                }
                this._sessions[sessionId] = streamSession
                this.monitorSession(sessionId)

                resolve(sessionId)
            }).catch((error) => {
                reject(error)
            })
        })
    }

    stopStream(sessionId){
        return new Promise((resolve, reject) => {
            const session = this.getSession(sessionId)
            if(session === undefined){
                resolve(true)
                return
            }

            this.getApi(session.type).stopStream(sessionId).then((result) => {
                console.log('Current sessions:', this._sessions)
                delete this._sessions[sessionId]
                this.monitorFailures.delete(sessionId)
                console.log('new sessions:', this._sessions)

                resolve(result)
            }).catch((error) => {
                reject(error)
            })
        })
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
        setTimeout(async () => {
            const session = this.getSession(sessionId)
            if (!session || session.playerState === 'failed' || session.playerState === 'started') return
            const fail = (code: string, message: string) => {
                if (this.getSession(sessionId) !== session) return
                session.errorDetails = { code, message }
                session.playerState = 'failed'
                this.monitorFailures.delete(sessionId)
            }
            try {
                const api = this.getApi(session.type)
                const result: any = await api.getStreamState(sessionId)
                if (this.getSession(sessionId) !== session) return
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
                    if (this.getSession(sessionId) !== session) return
                    await api.sendMSALAuth(sessionId, token.data.lpt)
                } else if (result.state === 'WaitingForResources') {
                    session.playerState = 'queued'
                    if (!session.waitingTimes) {
                        try {
                            const waitingTimes = await api.getWaitingTimes(session.target)
                            if (this.getSession(sessionId) !== session) return
                            session.waitingTimes = waitingTimes
                        } catch {
                            // Queue estimates are optional; continue monitoring the stream.
                        }
                    }
                }
                this.monitorFailures.delete(sessionId)
            } catch (error) {
                if (this.getSession(sessionId) !== session) return
                const failures = (this.monitorFailures.get(sessionId) || 0) + 1
                this.monitorFailures.set(sessionId, failures)
                if (error?.status === 404 || failures >= 5) {
                    fail('StreamStateUnavailable', 'Unable to retrieve the streaming session. Please reconnect.')
                    return
                }
            }
            if (this.getSession(sessionId) === session) this.monitorSession(sessionId)
        }, 1000)
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