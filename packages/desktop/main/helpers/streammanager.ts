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

// Remote Play should not wait indefinitely for a console to register.
// Keep the existing V3 cloud queue allowance for both desktop engines.
export const homeProvisioningDeadlineMs=180000
export const cloudProvisioningDeadlineMs=30*60*1000

export default class StreamManager {

    _application:Application

    _sessions:Record<string,streamSession> = Object.create(null)
    private monitorFailures = new Map<string, number>()
    private monitorTimers = new Map<string, ReturnType<typeof setTimeout>>()
    private monitorInFlight = new Map<string,streamSession>()
    private provisioning = new Map<string,{session:streamSession;timer:ReturnType<typeof setTimeout>;authenticated:boolean}>()
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
        const operation=Promise.resolve().then(()=>this.getApi(session.type).stopStream(sessionId)).catch(error=>{
            // A remote session which no longer exists is already stopped.
            // Other failures are not proof of termination; retain ownership
            // and allow a later retry instead of starting another stream.
            if(error?.status===404||error?.status===410)return true
            throw error
        }).then(result=>{
            if(this.getSession(sessionId)===session){this.clearProvisioning(session);if(this.monitorInFlight.get(sessionId)===session)this.monitorInFlight.delete(sessionId);delete this._sessions[sessionId];this.monitorFailures.delete(sessionId)}
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

    private clearProvisioning(session:streamSession){
        const id=session.id
        const operation=this.provisioning.get(id)
        if(operation?.session!==session)return
        this.cancel(operation.timer)
        this.provisioning.delete(id)
    }

    monitorSession(sessionId: string) {
        if(this.monitorTimers.has(sessionId)||this.monitorInFlight.has(sessionId)||this.stopping.has(sessionId))return
        const session=this.getSession(sessionId)
        if(!session||session.playerState==='failed'||session.playerState==='started')return
        const pending=()=>this.getSession(sessionId)===session&&session.playerState!=='failed'&&session.playerState!=='started'
        const active=()=>pending()&&!this.stopping.has(sessionId)
        const fail=(code:string,message:string)=>{
            if(!pending())return
            session.errorDetails={code,message}
            session.playerState='failed'
            this.monitorFailures.delete(sessionId)
            const scheduled=this.monitorTimers.get(sessionId)
            if(scheduled!==undefined)this.cancel(scheduled)
            this.monitorTimers.delete(sessionId)
            this.clearProvisioning(session)
            // Preserve the session ID for explicit stop or reconnect. A late
            // response must not revive the expired provisioning attempt.
            if(this.monitorInFlight.get(sessionId)===session)this.monitorInFlight.delete(sessionId)
        }
        let operation=this.provisioning.get(sessionId)
        if(!operation){
            const deadline=session.type==='home'?homeProvisioningDeadlineMs:cloudProvisioningDeadlineMs
            const timer=this.schedule(()=>fail('StreamProvisioningTimeout','The Xbox session did not become ready before the provisioning deadline.'),deadline)
            operation={session,timer,authenticated:false}
            this.provisioning.set(sessionId,operation)
        }
        const provisioning=operation
        const timer=this.schedule(async()=>{
            if(this.monitorTimers.get(sessionId)!==timer)return
            this.monitorTimers.delete(sessionId)
            if(!active())return
            this.monitorInFlight.set(sessionId,session)
            try{
                const api=this.getApi(session.type)
                const result:any=await api.getStreamState(sessionId)
                if(!active())return
                session.state=result.state
                if(result.state==='Provisioned'){
                    session.playerState='started'
                    this.monitorFailures.delete(sessionId)
                    this.clearProvisioning(session)
                    return
                }
                if(result.state==='Failed'){
                    fail(result.errorDetails?.code||'StreamFailed',result.errorDetails?.message||'Stream provisioning failed')
                    return
                }
                if(result.state==='ReadyToConnect'&&!provisioning.authenticated){
                    const token=await this._application._authentication._msal.getMsalToken()
                    if(!active())return
                    await api.sendMSALAuth(sessionId,token.data.lpt)
                    if(!active())return
                    provisioning.authenticated=true
                }else if(result.state==='WaitingForResources'){
                    session.playerState='queued'
                    if(!session.waitingTimes){
                        try{
                            const waitingTimes=await api.getWaitingTimes(session.target)
                            if(!active())return
                            session.waitingTimes=waitingTimes
                        }catch{
                            // Queue estimates are optional.
                        }
                    }
                }
                if(active())this.monitorFailures.delete(sessionId)
            }catch(error){
                if(!active())return
                const failures=(this.monitorFailures.get(sessionId)||0)+1
                this.monitorFailures.set(sessionId,failures)
                if(error?.status===404||error?.status===410||failures>=5)fail('StreamStateUnavailable','Unable to retrieve the streaming session. Please reconnect.')
            }finally{
                if(this.monitorInFlight.get(sessionId)===session)this.monitorInFlight.delete(sessionId)
                if(active())this.monitorSession(sessionId)
            }
        },1000)
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