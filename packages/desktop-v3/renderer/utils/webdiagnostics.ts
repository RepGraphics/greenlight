import {sanitizeSample,createDiagnosticReport,type DiagnosticSample} from '../../../desktop/renderer/lib/streamdiagnostics'
import {appendGraphSample} from '../../../desktop/renderer/lib/networkgraph'
import type {StreamMetrics} from '../../../player/src/client/metrics'

export function appendWebDiagnostic(samples:DiagnosticSample[],metrics:StreamMetrics,elapsedSeconds:number){
    if(!Number.isFinite(elapsedSeconds)||elapsedSeconds<0)return samples
    const clamp=(value:number,max:number)=>Number.isFinite(value)?Math.min(max,Math.max(0,value)):0
    const sample=sanitizeSample({
        width:clamp(metrics.width,16384),height:clamp(metrics.height,16384),
        fps:clamp(metrics.fps,1000),bitrate:clamp(metrics.bitrate,10000),
        jitter:clamp(metrics.jitter,60000),loss:clamp(metrics.loss,1e12),rtt:clamp(metrics.rtt,60000),
        statsFresh:metrics.statsFresh===true,statsAgeMs:clamp(metrics.statsAgeMs??0,86400000),
        peerState:metrics.peerState,iceState:metrics.iceState,signalingState:metrics.signalingState,
    },Math.min(86400,elapsedSeconds))
    return appendGraphSample(samples,sample)
}
export function webDiagnosticReport(samples:DiagnosticSample[],type:'home'|'cloud',status:string,reason:string){
    const state=['Initializing','Connecting','Negotiated','Connected','Reconnecting','Error','Provisioning','Queued','Failed'].includes(status)?status:'Unknown'
    const failure=['media','transport','stats','heartbeat','server','closed','keepalive'].includes(reason)?reason:''
    return createDiagnosticReport(samples,type,state,'video',[],failure)
}
