import type { StreamMetrics } from '../../../player/src/client/index'

export type DiagnosticSample = StreamMetrics & { elapsedSeconds: number }
export function sanitizeSample(metrics: StreamMetrics, elapsedSeconds: number): DiagnosticSample {
    const number = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0
    return { elapsedSeconds: number(elapsedSeconds), width: number(metrics.width), height: number(metrics.height), fps: number(metrics.fps), bitrate: number(metrics.bitrate), jitter: number(metrics.jitter), loss: number(metrics.loss), rtt: number(metrics.rtt), ...(typeof metrics.statsFresh==='boolean'?{statsFresh:metrics.statsFresh,statsAgeMs:number(metrics.statsAgeMs??0)}:{}), ...(typeof metrics.peerState==='string'&&['new','connecting','connected','disconnected','failed','closed'].includes(metrics.peerState)?{peerState:metrics.peerState}:{}), ...(typeof metrics.iceState==='string'&&['new','checking','connected','completed','disconnected','failed','closed'].includes(metrics.iceState)?{iceState:metrics.iceState}:{}), ...(typeof metrics.signalingState==='string'&&['stable','have-local-offer','have-remote-offer','have-local-pranswer','have-remote-pranswer','closed'].includes(metrics.signalingState)?{signalingState:metrics.signalingState}:{}) }
}

export function summarizeDiagnostics(samples: DiagnosticSample[]) {
    const valid = samples.filter(sample => sample.width > 0 && sample.height > 0 && sample.statsFresh!==false)
    const round = (value: number) => Math.round(value * 100) / 100
    const mean = (values: number[]) => values.length ? round(values.reduce((sum,value) => sum + value,0) / values.length) : null
    const percentile = (values: number[], p: number) => values.length ? [...values].sort((a,b) => a-b)[Math.max(0,Math.ceil(values.length*p)-1)] : null
    const rtt = valid.map(sample => sample.rtt).filter(value => value > 0)
    const jitter = valid.map(sample => sample.jitter)
    const loss = valid.length > 1 ? Math.max(0,valid[valid.length-1].loss-valid[0].loss) : 0
    const rtt95 = percentile(rtt,0.95)
    const jitter95 = percentile(jitter,0.95)
    const quality = valid.length < 5 || rtt.length < 5 ? 'insufficient' : (rtt95 ?? 0) > 150 || (jitter95 ?? 0) > 30 ? 'poor' : (rtt95 ?? 0) > 80 || (jitter95 ?? 0) > 15 ? 'fair' : 'good'
    return { sampleCount:valid.length, averageFps:mean(valid.map(sample => sample.fps)), averageBitrate:mean(valid.map(sample => sample.bitrate).filter(value => value > 0)), rtt95, jitter95, packetsLostDuringWindow:loss, quality }
}

export function downloadDiagnostics(samples: DiagnosticSample[], type: 'cloud' | 'home', state: string, renderer: string, previousAttempts: Array<{state:string;reason:string;samples:DiagnosticSample[]}>=[], failureReason='') {
    const report = { schema: 4, previousAttempts, failureReason, summary: summarizeDiagnostics(samples), engine: 'v3', type, renderer: renderer === 'webgpu' ? 'webgpu' : 'video', state, units: { bitrate: 'Mbps', jitter: 'ms', rtt: 'ms', loss: 'cumulative packets' }, samples }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'greenlight-stream-diagnostics.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
