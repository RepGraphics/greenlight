import type {DiagnosticSample} from './streamdiagnostics'

type Report = Record<string,any>
type Stats = {forEach:(callback:(report:Report)=>void)=>void;get:(id:string)=>Report|undefined}
type Peer = Pick<DiagnosticSample,'peerState'|'iceState'|'signalingState'>
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:0
// Select one primary inbound stream and require real progress. Counter resets,
// track switches, frozen timestamps and long gaps never become bitrate evidence.
export class ClassicMetricsSampler {
    private previous:{id:string;bytes:number;timestamp:number;observedAt:number}|undefined
    sample(stats:Stats,now:number,peer:Peer={}):Omit<DiagnosticSample,'elapsedSeconds'>{
        const video:Report[]=[]
        let rtt=0
        stats.forEach(report=>{
            if(report.type==='inbound-rtp'&&(report.kind??report.mediaType)==='video'&&typeof report.id==='string'&&Number.isFinite(report.bytesReceived)&&report.bytesReceived>=0&&Number.isFinite(report.timestamp))video.push(report)
            if(report.type==='transport'&&report.selectedCandidatePairId){const pair=stats.get(report.selectedCandidatePairId);rtt=Math.max(rtt,finite(pair?.currentRoundTripTime)*1000)}
        })
        video.sort((a,b)=>finite(b.frameWidth)*finite(b.frameHeight)-finite(a.frameWidth)*finite(a.frameHeight)||b.bytesReceived-a.bytesReceived)
        const report=video[0]
        if(!report){this.previous=undefined;return {width:0,height:0,fps:0,jitter:0,loss:0,bitrate:0,rtt:0,statsFresh:false,...peer}}
        const previous=this.previous
        this.previous={id:report.id,bytes:report.bytesReceived,timestamp:report.timestamp,observedAt:now}
        const elapsed=previous?report.timestamp-previous.timestamp:0
        const fresh=Boolean(previous&&previous.id===report.id&&elapsed>0&&elapsed<=3000&&now-previous.observedAt<=3000&&report.bytesReceived>previous.bytes)
        return {width:finite(report.frameWidth),height:finite(report.frameHeight),fps:fresh?finite(report.framesPerSecond):0,jitter:finite(report.jitter)*1000,loss:finite(report.packetsLost),bitrate:fresh?(report.bytesReceived-previous!.bytes)*8/elapsed/1000:0,rtt,statsFresh:fresh,...peer}
    }
}
