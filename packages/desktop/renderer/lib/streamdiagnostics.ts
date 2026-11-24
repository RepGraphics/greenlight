import type { StreamMetrics } from '../../../player/src/client/index'

export type DiagnosticSample = StreamMetrics & { elapsedSeconds: number }
export function sanitizeSample(metrics: StreamMetrics, elapsedSeconds: number): DiagnosticSample {
    const number = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value * 100) / 100) : 0
    return { elapsedSeconds: number(elapsedSeconds), width: number(metrics.width), height: number(metrics.height), fps: number(metrics.fps), bitrate: number(metrics.bitrate), jitter: number(metrics.jitter), loss: number(metrics.loss), rtt: number(metrics.rtt) }
}

export function downloadDiagnostics(samples: DiagnosticSample[], type: 'cloud' | 'home', state: string, renderer: string) {
    const report = { schema: 1, engine: 'v3', type, renderer: renderer === 'webgpu' ? 'webgpu' : 'video', state, units: { bitrate: 'Mbps', jitter: 'ms', rtt: 'ms', loss: 'cumulative packets' }, samples }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'greenlight-stream-diagnostics.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
