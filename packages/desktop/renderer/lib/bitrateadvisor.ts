import { summarizeDiagnostics } from './streamdiagnostics'
import type { DiagnosticSample } from './streamdiagnostics'

// Conservative advice only: the receiver cannot set the remote sender's
// encoding parameters. Apply a cap on the next SDP negotiation.
export function recommendLowerBitrate(samples: DiagnosticSample[], configuredCap: number): number | null {
    const recent = samples.slice(-20).filter(sample=>sample.width>0&&sample.height>0&&sample.rtt>0&&sample.bitrate>0)
    if(recent.length<15 || recent[recent.length-1].elapsedSeconds-recent[0].elapsedSeconds<12) return null
    const first = summarizeDiagnostics(recent.slice(0,Math.floor(recent.length/2)))
    const second = summarizeDiagnostics(recent.slice(Math.floor(recent.length/2)))
    if(first.quality!=='poor'||second.quality!=='poor') return null
    const observed = Math.min(first.averageBitrate??0,second.averageBitrate??0)*1000
    const cap = Number.isFinite(configuredCap)&&configuredCap>0?configuredCap:40960
    const target = Math.min(observed*0.75,cap*0.75)
    return [20480,15360,10240,8192,6144,4096,2048].find(value=>value<=target)??null
}
