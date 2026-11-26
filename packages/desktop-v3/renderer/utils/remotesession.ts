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
    return {
        async start(){return returnedSessionPath(await rpc.start(request),config.type)},
        async stop(path:string){
            const result=await rpc.stop({...request,sessionPath:sessionEndpoint(config.type,path)}) as {status?:number}|null
            const status=result?.status
            if(typeof status!=='number'||!(status>=200&&status<300||status===404||status===410))throw Error('Xbox session stop not acknowledged')
        },
        player(path:string):communicationHandler{
            const sessionPath=sessionEndpoint(config.type,path)
            const input={...request,sessionPath}
            return {
                getSessionId:()=>sessionPath.split('/').at(-1)!,
                getSessionPath:()=>sessionPath,
                getStreamConfig:()=>({...request.xCloudStreamConfig}),
                getStreamStatus:()=>rpc.status(input),
                sendSDPOffer:sdpOffer=>rpc.sdp({...input,sdpOffer}),
                sendICECandidates:candidates=>rpc.ice({...input,candidates:candidates.map(candidate=>{
                    const value=typeof candidate==='string'?JSON.parse(candidate):candidate
                    if(!value||typeof value!=='object'||typeof value.candidate!=='string')throw Error('Invalid ICE candidate')
                    return value
                })}),
                sendMSALToken:()=>rpc.connect({...input,refreshToken}),
                sendKeepalive:()=>rpc.keepalive(input),
            }
        },
    }
}
