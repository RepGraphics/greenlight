import { summarizeDiagnostics } from './streamdiagnostics'
import type { DiagnosticSample } from './streamdiagnostics'

export interface SessionRecord {
    startedAt: number
    durationSeconds: number
    type: 'cloud' | 'home'
    outcome: 'ended' | 'failed' | 'interrupted'
    averageFps: number | null
    averageBitrate: number | null
    rtt95: number | null
    quality: string
}
const key = 'greenlight.v3.session-history'
export function makeSessionRecord(startedAt: number, connectedAt: number, endedAt: number, type: SessionRecord['type'], outcome: SessionRecord['outcome'], samples: DiagnosticSample[]): SessionRecord {
    const stats = summarizeDiagnostics(samples)
    return {startedAt,durationSeconds:connectedAt ? Math.max(0,Math.round((endedAt-connectedAt)/1000)) : 0,type,outcome,averageFps:stats.averageFps,averageBitrate:stats.averageBitrate,rtt95:stats.rtt95,quality:stats.quality}
}
export function readSessionHistory(): SessionRecord[] {
    try {
        const data = JSON.parse(localStorage.getItem(key) || '[]')
        if (!Array.isArray(data)) return []
        return data.filter(item => item && typeof item.startedAt === 'number' && Number.isFinite(item.startedAt) && typeof item.durationSeconds === 'number' && Number.isFinite(item.durationSeconds) && item.durationSeconds >= 0 && ['home','cloud'].includes(item.type) && ['ended','failed','interrupted'].includes(item.outcome)).slice(0,100).map(item => {
            const metric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
            return {startedAt:item.startedAt,durationSeconds:item.durationSeconds,type:item.type,outcome:item.outcome,averageFps:metric(item.averageFps),averageBitrate:metric(item.averageBitrate),rtt95:metric(item.rtt95),quality:['good','fair','poor'].includes(item.quality)?item.quality:'insufficient'}
        })
    } catch { return [] }
}
export function addSession(record: SessionRecord) {
    try { localStorage.setItem(key,JSON.stringify([record,...readSessionHistory()].slice(0,100))) } catch {}
}
export function clearSessionHistory() {
    try { localStorage.removeItem(key); return true } catch { return false }
}
