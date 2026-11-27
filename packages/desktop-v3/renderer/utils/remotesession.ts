import type {xCloudStreamConfig,xStreamToken,communicationHandler} from '@greenlight/player/client'
import {streamOrigin,sessionEndpoint} from '../../../player/src/server/requestpolicy'
import {StreamStartFailure} from './startfailure'

type Request={token:xStreamToken;xCloudStreamConfig:xCloudStreamConfig}
type SessionRequest=Request&{sessionPath:string}
export interface RemoteRpc{
    start(input:Request):Promise<unknown>
    stop(input:SessionRequest):Promise<unknown>
    status(input:SessionRequest):Promise<unknown>
    sdp(input:SessionRequest&{sdpOffer:RTCSessionDescriptionInit}):Promise<unknown>
    chat?(input:SessionRequest&{offer:RTCSessionDescriptionInit}):Promise<unknown>
    ice(input:SessionRequest&{candidates:unknown[]}):Promise<unknown>
    connect(input:SessionRequest&{refreshToken:string}):Promise<unknown>
    keepalive(input:SessionRequest):Promise<unknown>
}
export function defaultStreamOrigin(regions:unknown){
    if(!Array.isArray(regions))throw Error('Xbox streaming regions unavailable')
    const defaults=regions.filter(region=>region?.isDefault===true)
    if(defaults.length!==1)throw Error('Xbox default streaming region unavailable')
    return streamOrigin(defaults[0].baseUri)
}
export function returnedSessionPath(result:unknown,type:'home'|'cloud'){
    const value=result as {sessionPath?:unknown;sessionId?:unknown}|null
    const path=sessionEndpoint(type,value?.sessionPath)
    const id=path.split('/').at(-1)
    if(value?.sessionId!==undefined&&value.sessionId!==id)throw Error('Inconsistent Xbox session identifier')
    return path
}
export type WebStreamTarget={id:string;name:string;type:'home'}|{id:string;name:string;type:'cloud';entitled:boolean}
export function selectStreamCredentials(target:WebStreamTarget,home:xStreamToken,cloud:xStreamToken,regions:{home:unknown;cloud:unknown}){
    if(!target.id||target.id.length>160||(target.type==='cloud'&&target.entitled!==true))throw new StreamStartFailure('start-target')
    const token=target.type==='cloud'?cloud:home
    if(!token.token)throw new StreamStartFailure('start-authorization')
    try {return {token,host:defaultStreamOrigin(regions[target.type])}}
    catch {throw new StreamStartFailure('start-region')}
}
export function provisioningMessage(value:unknown):string|null{
    const state=(value as {state?:unknown}|null)?.state
    if(state==='WaitingForResources')return 'Waiting in the Xbox Cloud Gaming queue…'
    if(state==='ReadyToConnect')return 'Authorizing Xbox session…'
    if(state==='Provisioned')return 'Negotiating stream…'
    if(state==='Provisioning')return 'Provisioning Xbox session…'
    return null
}
// Bound the caller's wait without pretending that an abandoned RPC was
// cancelled. In particular, never race DELETE against pending signaling.
function waitFor<T>(pending:Promise<T>,milliseconds:number,message:string):Promise<T>{
    return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error(message)),milliseconds)
        void pending.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)})
    })
}
type StreamAuthorization = {kind:'desktop'} | {kind:'web'; refreshToken:string}

export function createRemoteSession(rpc:RemoteRpc,config:xCloudStreamConfig,token:xStreamToken,authorization:StreamAuthorization,onProvisioning?:(message:string)=>void,deadlines={drainMs:75000,stopMs:25000}){
    if(!token.token||(authorization.kind==='web'&&!authorization.refreshToken))throw new StreamStartFailure('start-authorization')
    if(!config.id)throw new StreamStartFailure('start-target')
    const refreshToken=authorization.kind==='web'?authorization.refreshToken:''
    const request={token:{...token},xCloudStreamConfig:{...config,host:streamOrigin(config.host)}}
    let closing=false
    let ownedPath:string|undefined
    let starting:Promise<string>|undefined
    let stopping:Promise<void>|undefined
    let stopRequest:Promise<void>|undefined
    let closedPath:string|undefined
    const inFlight=new Set<Promise<unknown>>()
    const operate=<T>(path:string,operation:()=>Promise<T>):Promise<T>=>{
        if(closing||path!==ownedPath)return Promise.reject(Error('Xbox session is not active'))
        // Register synchronously so stop cannot race an untracked request.
        const pending=Promise.resolve().then(operation)
        inFlight.add(pending)
        void pending.then(()=>inFlight.delete(pending),()=>inFlight.delete(pending))
        return pending
    }
    return {
        start(){
            if(closing)return Promise.reject(Error('Xbox session is closing'))
            if(starting)return starting
            starting=Promise.resolve().then(()=>rpc.start(request)).then(result=>{
                ownedPath=returnedSessionPath(result,config.type)
                return ownedPath
            })
            return starting
        },
        stop(path:string){
            const sessionPath=sessionEndpoint(config.type,path)
            if(sessionPath===closedPath)return Promise.resolve()
            if(sessionPath!==ownedPath)return Promise.reject(Error('Xbox session is not owned'))
            if(stopping)return stopping
            closing=true
            const operation=(async()=>{
                await waitFor(Promise.allSettled([...inFlight]),deadlines.drainMs,'Xbox signaling still pending')
                if(closedPath===sessionPath)return
                if(!stopRequest){
                    const requestPending=Promise.resolve().then(()=>rpc.stop({...request,sessionPath})).then(value=>{
                        const result=value as {status?:number}|null
                        const status=result?.status
                        if(typeof status!=='number'||!Number.isInteger(status)||!(status>=200&&status<300||status===404||status===410))throw Error('Xbox session stop not acknowledged')
                        closedPath=sessionPath
                        ownedPath=undefined
                    }).finally(()=>{if(stopRequest===requestPending)stopRequest=undefined})
                    stopRequest=requestPending
                }
                // A retry shares any outstanding DELETE. A late acknowledgement
                // is remembered for the exact owned path, even after timeout.
                await waitFor(stopRequest,deadlines.stopMs,'Xbox session stop acknowledgement timed out')
            })()
            const pending=operation.finally(()=>{if(stopping===pending)stopping=undefined})
            stopping=pending
            return pending
        },
        player(path:string):communicationHandler{
            const sessionPath=sessionEndpoint(config.type,path)
            if(closing||sessionPath!==ownedPath)throw Error('Xbox session is not owned')
            const input={...request,sessionPath}
            return {
                getSessionId:()=>sessionPath.split('/').at(-1)!,
                getSessionPath:()=>sessionPath,
                getStreamConfig:()=>({...request.xCloudStreamConfig}),
                getStreamStatus:()=>operate(sessionPath,async()=>{
                    const result=await rpc.status(input)
                    const message=provisioningMessage(result)
                    if(!closing&&message)onProvisioning?.(message)
                    return result
                }),
                sendSDPOffer:sdpOffer=>operate(sessionPath,()=>rpc.sdp({...input,sdpOffer})),
                ...(rpc.chat?{sendChatSDP:(offer:RTCSessionDescriptionInit)=>operate(sessionPath,async()=>{
                    if(offer.type!=='offer'||typeof offer.sdp!=='string'||!offer.sdp.trim()||offer.sdp.length>262144)throw Error('Invalid chat SDP offer')
                    const answer=await rpc.chat!({...input,offer})
                    if(typeof answer!=='string'||!answer.trim()||answer.length>262144)throw Error('Invalid chat SDP answer')
                    return answer
                })}:{}),
                sendICECandidates:candidates=>{
                    const parsed=candidates.map(candidate=>{
                    const value=typeof candidate==='string'?JSON.parse(candidate):candidate
                    if(!value||typeof value!=='object'||typeof value.candidate!=='string')throw Error('Invalid ICE candidate')
                    return value
                    })
                    return operate(sessionPath,()=>rpc.ice({...input,candidates:parsed}))
                },
                sendMSALToken:()=>operate(sessionPath,()=>rpc.connect({...input,refreshToken})),
                sendKeepalive:()=>operate(sessionPath,()=>rpc.keepalive(input)),
            }
        },
    }
}
