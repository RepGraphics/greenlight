import type {xCloudStreamConfig,xStreamToken} from '../../../player/src/types/index'
import type {communicationHandler} from '../../../player/src/client/index'
import {streamOrigin,sessionEndpoint} from '../../../player/src/server/requestpolicy'

type Request={token:xStreamToken;xCloudStreamConfig:xCloudStreamConfig}
type SessionRequest=Request&{sessionPath:string}
export interface RemoteRpc{
    start(input:Request):Promise<unknown>
    stop(input:SessionRequest):Promise<unknown>
    status(input:SessionRequest):Promise<unknown>
    sdp(input:SessionRequest&{sdpOffer:RTCSessionDescriptionInit}):Promise<unknown>
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
export function createRemoteSession(rpc:RemoteRpc,config:xCloudStreamConfig,token:xStreamToken,refreshToken:string){
    if(!token.token||!refreshToken||!config.id)throw Error('Xbox streaming authorization unavailable')
    const request={token:{...token},xCloudStreamConfig:{...config,host:streamOrigin(config.host)}}
    let closing=false
    let ownedPath:string|undefined
    let starting:Promise<string>|undefined
    let stopping:Promise<void>|undefined
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
            if(sessionPath!==ownedPath)return Promise.reject(Error('Xbox session is not owned'))
            if(stopping)return stopping
            closing=true
            const operation=(async()=>{
                await Promise.allSettled([...inFlight])
                const result=await rpc.stop({...request,sessionPath}) as {status?:number}|null
                const status=result?.status
                if(typeof status!=='number'||!Number.isInteger(status)||!(status>=200&&status<300||status===404||status===410))throw Error('Xbox session stop not acknowledged')
                ownedPath=undefined
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
                getStreamStatus:()=>operate(sessionPath,()=>rpc.status(input)),
                sendSDPOffer:sdpOffer=>operate(sessionPath,()=>rpc.sdp({...input,sdpOffer})),
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
