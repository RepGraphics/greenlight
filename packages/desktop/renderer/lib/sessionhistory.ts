import { summarizeDiagnostics } from './streamdiagnostics'
import type { DiagnosticSample } from './streamdiagnostics'

export interface SessionRecord {
    engine: 'classic' | 'v3'
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
export function makeSessionRecord(startedAt: number, connectedAt: number, endedAt: number, type: SessionRecord['type'], outcome: SessionRecord['outcome'], samples: DiagnosticSample[], engine:SessionRecord['engine']='v3'): SessionRecord {
    const stats = summarizeDiagnostics(samples)
    return {engine,startedAt,durationSeconds:connectedAt ? Math.max(0,Math.round((endedAt-connectedAt)/1000)) : 0,type,outcome,averageFps:stats.averageFps,averageBitrate:stats.averageBitrate,rtt95:stats.rtt95,quality:stats.quality}
}
export function readSessionHistory(): SessionRecord[] {
    try {
        const data = JSON.parse(localStorage.getItem(key) || '[]')
        if (!Array.isArray(data)) return []
        return data.filter(item => item && typeof item.startedAt === 'number' && Number.isFinite(item.startedAt) && item.startedAt>=0 && item.startedAt<=8640000000000000 && typeof item.durationSeconds === 'number' && Number.isFinite(item.durationSeconds) && item.durationSeconds >= 0 && ['home','cloud'].includes(item.type) && ['ended','failed','interrupted'].includes(item.outcome)).slice(0,100).map(item => {
            const metric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
            return {engine:item.engine==='classic'?'classic':'v3',startedAt:item.startedAt,durationSeconds:item.durationSeconds,type:item.type,outcome:item.outcome,averageFps:metric(item.averageFps),averageBitrate:metric(item.averageBitrate),rtt95:metric(item.rtt95),quality:['good','fair','poor'].includes(item.quality)?item.quality:'insufficient'}
        })
    } catch { return [] }
}
export function addSession(record: SessionRecord) {
    try { localStorage.setItem(key,JSON.stringify([record,...readSessionHistory()].slice(0,100))) } catch {}
}
export function clearSessionHistory() {
    try { localStorage.removeItem(key); return true } catch { return false }
}

export function filterHistory(records:SessionRecord[],type:string,engine:string,outcome:string){
    return records.filter(item=>(type==='all'||item.type===type)&&(engine==='all'||item.engine===engine)&&(outcome==='all'||item.outcome===outcome))
}
export function historyTotals(records:SessionRecord[]){
    const durationSeconds=records.reduce((total,item)=>total+item.durationSeconds,0)
    return {count:records.length,durationSeconds,ended:records.filter(item=>item.outcome==='ended').length,failed:records.filter(item=>item.outcome==='failed').length,interrupted:records.filter(item=>item.outcome==='interrupted').length}
}
export function historyCsv(records:SessionRecord[]){
    const rows=records.map(item=>[new Date(item.startedAt).toISOString(),item.engine,item.type,item.outcome,item.durationSeconds,item.averageFps??'',item.averageBitrate??'',item.rtt95??'',item.quality])
    return ['started_at_utc,engine,mode,outcome,duration_seconds,average_fps,average_mbps,rtt_p95_ms,quality',...rows.map(row=>row.join(','))].join('\r\n')+'\r\n'
}
export function exportHistory(records:SessionRecord[]){
    const url=URL.createObjectURL(new Blob([historyCsv(records)],{type:'text/csv;charset=utf-8'}))
    const link=document.createElement('a');link.href=url;link.download='greenlight-session-history.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
