import type {DiagnosticSample} from './streamdiagnostics'
export type GraphMetric='rtt'|'jitter'|'fps'|'bitrate'
export function graphData(samples:DiagnosticSample[],metric:GraphMetric,seconds:number){
    const end=samples[samples.length-1]?.elapsedSeconds??0
    const start=Math.max(0,end-seconds)
    const valid=(s:DiagnosticSample)=>s.statsFresh!==false&&s.width>0&&s.height>0&&Number.isFinite(s[metric])&&s[metric]>=0&&(metric!=='rtt'||s.rtt>0)
    const recent=samples.filter(s=>s.elapsedSeconds>=start&&s.elapsedSeconds<=end)
    const max=Math.max(1,...recent.filter(valid).map(s=>s[metric]))
    const segments:string[][]=[]
    let previous:number|undefined
    let segment:string[]=[]
    for(const s of recent){
        if(!valid(s)||(previous!==undefined&&s.elapsedSeconds-previous>3)){if(segment.length)segments.push(segment);segment=[]}
        if(valid(s)){segment.push(((s.elapsedSeconds-start)/Math.max(1,end-start)*240).toFixed(1)+','+(74-s[metric]/max*64).toFixed(1));previous=s.elapsedSeconds}
        else previous=undefined
    }
    if(segment.length)segments.push(segment)
    const last=recent[recent.length-1]
    return {max,segments:segments.map(s=>s.join(' ')),last:last&&valid(last)?last[metric]:undefined}
}

// Bound graph history by time and sample count, preserving unavailable samples
// as gaps. Reset if an elapsed clock restarts (e.g. a new stream attempt).
export function appendGraphSample(samples:DiagnosticSample[],sample:DiagnosticSample){
    if(!Number.isFinite(sample.elapsedSeconds)||sample.elapsedSeconds<0)return samples
    const last=samples.at(-1)
    if(last&&sample.elapsedSeconds<last.elapsedSeconds)return [sample]
    const next=last&&last.elapsedSeconds===sample.elapsedSeconds?samples.slice(0,-1):samples
    return [...next.filter(item=>item.elapsedSeconds>=sample.elapsedSeconds-300).slice(-299),sample]
}
