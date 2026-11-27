import { sanitizeSample, streamFailureReasons } from './streamdiagnostics'
import type { DiagnosticSample } from './streamdiagnostics'
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}
export const diagnosticFileLimit=2*1024*1024
export interface ImportedAttempt {state:string;reason:string;samples:DiagnosticSample[]}
const states=['Initializing','Connecting','Negotiated','Connected','Reconnecting','Error','Provisioning','Queued','Failed']
function samples(value:unknown):DiagnosticSample[]{
    if(!Array.isArray(value))return []
    return value.slice(-300).flatMap(item=>{
        const raw=object(item)
        if(typeof raw.elapsedSeconds!=='number'||!Number.isFinite(raw.elapsedSeconds)||raw.elapsedSeconds<0||raw.elapsedSeconds>86400)return []
        const number=(key:string,max:number)=>typeof raw[key]==='number'&&Number.isFinite(raw[key])?Math.max(0,Math.min(max,raw[key] as number)):0
        return [sanitizeSample({width:number('width',16384),height:number('height',16384),fps:number('fps',1000),bitrate:number('bitrate',10000),jitter:number('jitter',60000),loss:number('loss',1e12),rtt:number('rtt',60000),statsFresh:typeof raw.statsFresh==='boolean'?raw.statsFresh:undefined,statsAgeMs:number('statsAgeMs',86400000),peerState:typeof raw.peerState==='string'?raw.peerState:undefined,iceState:typeof raw.iceState==='string'?raw.iceState:undefined,signalingState:typeof raw.signalingState==='string'?raw.signalingState:undefined},raw.elapsedSeconds)]
    }).sort((a,b)=>a.elapsedSeconds-b.elapsedSeconds)
}
function attempt(raw:Record<string,unknown>):ImportedAttempt{
    return {state:typeof raw.state==='string'&&states.includes(raw.state)?raw.state:'Unknown',reason:typeof raw.reason==='string'&&streamFailureReasons.includes(raw.reason)?raw.reason:'',samples:samples(raw.samples)}
}
export function parseDiagnostics(text:string){
    if(text.length>diagnosticFileLimit||new TextEncoder().encode(text).byteLength>diagnosticFileLimit)throw Error('Diagnostic report too large')
    const raw=object(JSON.parse(text))
    if(typeof raw.schema!=='number'||![1,2,3,4].includes(raw.schema)||(raw.engine!=='v3'&&!(raw.engine==='classic'&&raw.schema===4))||!Array.isArray(raw.samples))throw Error('Unsupported diagnostic format')
    const current=attempt({...raw,reason:raw.failureReason})
    const previous=Array.isArray(raw.previousAttempts)?raw.previousAttempts.slice(-3).map(item=>attempt(object(item))):[]
    return {schema:Number(raw.schema),engine:raw.engine==='classic'?'classic':'v3',type:raw.type==='home'?'home':raw.type==='cloud'?'cloud':'unknown',renderer:raw.renderer==='webgpu'?'webgpu':'video',attempts:[...previous,current]}
}
