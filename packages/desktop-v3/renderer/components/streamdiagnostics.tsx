import {useState} from 'react'
import {graphData,type GraphMetric} from '../../../desktop/renderer/lib/networkgraph'
import {summarizeDiagnostics,streamFailureReasons,type DiagnosticSample} from '../../../desktop/renderer/lib/streamdiagnostics'
import {sessionBitrateLabel} from '../../../desktop/renderer/lib/sessionquality'
import {webDiagnosticReport} from '../utils/webdiagnostics'
import {downloadWebCapture} from '../utils/webcapture'

function Graph({samples,metric,label,unit,seconds}:{samples:DiagnosticSample[];metric:GraphMetric;label:string;unit:string;seconds:number}){
    const {max,segments,last}=graphData(samples,metric,seconds)
    return <div className="rounded border border-white/10 p-3 min-w-0">
        <div className="flex justify-between gap-2"><strong>{label}</strong><span>{last===undefined?'Unavailable':last.toFixed(1)+' '+unit}</span></div>
        <svg viewBox="0 0 240 80" className="w-full" role="img" aria-label={label+' history'}>
            <path d="M0 10H240 M0 42H240 M0 74H240" stroke="currentColor" opacity=".2" fill="none"/>
            {segments.map((points,index)=><polyline key={index} points={points} stroke="#9bf00b" strokeWidth="1.8" vectorEffect="non-scaling-stroke" fill="none"/>)}
        </svg>
        <p className="text-xs text-white/60">0–{max.toFixed(1)} {unit}</p>
    </div>
}
const display=(value:number|null,unit:string)=>value===null?'Unavailable':value.toFixed(1)+' '+unit
export default function StreamDiagnostics({samples,type,status,reason,recommendedCap,onApplyRecommendation}:{samples:DiagnosticSample[];type:'home'|'cloud';status:string;reason:string;recommendedCap:number|null;onApplyRecommendation:()=>void}){
    const [open,setOpen]=useState(false)
    const [seconds,setSeconds]=useState(60)
    const [error,setError]=useState(false)
    const summary=summarizeDiagnostics(samples)
    const exportReport=()=>{
        try{
            setError(false)
            const report=webDiagnosticReport(samples,type,status,reason)
            downloadWebCapture(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),'greenlight-web-diagnostics.json')
        }catch{setError(true)}
    }
    return <details className="my-3 rounded border border-white/10 p-3" onToggle={event=>setOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer font-semibold">Connection history and diagnostics</summary>
        {open&&<div className="mt-3 grid gap-3">
            <p className="text-sm text-white/60">Up to five minutes of local measurements, including gaps for stale samples. Quality is a latency and jitter estimate, not a guarantee of playability. The report includes only numeric measurements, known connection states and stream type; no tokens, addresses or game identifiers.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <p>Connection estimate: <strong>{summary.quality}</strong></p>
                <p>Valid samples: {summary.sampleCount}</p>
                <p>Average FPS: {display(summary.averageFps,'fps')}</p>
                <p>Average bitrate: {display(summary.averageBitrate,'Mbps')}</p>
                <p>95th percentile latency: {display(summary.rtt95,'ms')}</p>
                <p>95th percentile jitter: {display(summary.jitter95,'ms')}</p>
            </div>
            {recommendedCap!==null&&<div className="rounded border border-white/20 p-3">
                <p>Sustained latency or jitter detected. Consider a lower requested bitrate of {sessionBitrateLabel(recommendedCap,'Automatic')} on your next connection.</p>
                <p className="text-sm text-white/60 my-2">Save any captures first. This ends the current session and returns to setup only after Xbox acknowledges termination. Cloud Gaming may rejoin a queue. It does not change the current stream.</p>
                <button type="button" className="rounded border border-white/20 px-4 py-2" onClick={onApplyRecommendation}>End and use suggested cap</button>
            </div>}
            <label>Graph window <select className="bg-[#202020] rounded p-2" value={seconds} onChange={event=>setSeconds(Number(event.target.value))}>{[30,60,120,300].map(value=><option key={value} value={value}>{value} seconds</option>)}</select></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Graph samples={samples} metric="rtt" label="Latency" unit="ms" seconds={seconds}/>
                <Graph samples={samples} metric="jitter" label="Jitter" unit="ms" seconds={seconds}/>
                <Graph samples={samples} metric="fps" label="Frame rate" unit="fps" seconds={seconds}/>
                <Graph samples={samples} metric="bitrate" label="Bitrate" unit="Mbps" seconds={seconds}/>
            </div>
            <button type="button" className="rounded border border-white/20 px-4 py-2 disabled:opacity-50" disabled={!samples.length&&!streamFailureReasons.includes(reason)} onClick={exportReport}>Export diagnostics JSON</button>
            {error&&<p role="alert">Unable to download diagnostics in this browser.</p>}
        </div>}
    </details>
}
