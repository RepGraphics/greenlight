import {useEffect,useRef,useState} from 'react'
import {calibrationPads,calibratable,WebDeadzoneCalibration,type CalibrationPad,type CalibrationResult} from '../utils/webcontrollercalibration'

import {controllerConfirmationValid,type ControllerIdentity} from '../utils/controllerconfirmation'

const readPads=()=>{
    try{return calibrationPads(Array.from(navigator.getGamepads?.()??[]))}catch{return []}
}
function Stick({label,x,y,deadzone}:{label:string;x:number;y:number;deadzone:number}){
    const clamp=(value:number)=>Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0
    return <div className="text-center"><strong>{label}</strong><svg viewBox="0 0 120 120" className="w-28 mx-auto" role="img" aria-label={label+' position'}>
        <rect x="10" y="10" width="100" height="100" rx="8" fill="none" stroke="currentColor" opacity=".4"/>
        <rect x={60-50*deadzone} y={60-50*deadzone} width={100*deadzone} height={100*deadzone} fill="#107c10" opacity=".6"/>
        <path d="M60 10V110 M10 60H110" stroke="currentColor" opacity=".3"/>
        <circle cx={60+50*clamp(x)} cy={60+50*clamp(y)} r="5" fill="#9bf00b"/>
    </svg><p className="text-xs">X {clamp(x).toFixed(3)} · Y {clamp(y).toFixed(3)}</p></div>
}
export default function ControllerCalibration({deadzone,onApply}:{deadzone:number;onApply:(value:number)=>void}){
    const [open,setOpen]=useState(false)
    const [pads,setPads]=useState<CalibrationPad[]>([])
    const [selected,setSelected]=useState('')
    const [result,setResult]=useState<CalibrationResult|null>(null)
    const job=useRef<WebDeadzoneCalibration|null>(null)
    const source=useRef<ControllerIdentity|null>(null)
    const selectedRef=useRef(selected)
    selectedRef.current=selected
    const cancel=()=>{job.current=null;source.current=null;setResult(null)}
    useEffect(()=>{
        if(!open)return
        const tick=()=>{
            const current=readPads()
            setPads(current)
            const focused=!document.hidden&&document.hasFocus()
            const selectedPad=current.find(item=>String(item.index)===selectedRef.current)??current[0]
            if(source.current&&!controllerConfirmationValid(source.current,selectedPad,current,focused)){
                cancel();setResult({kind:'failed'});return
            }
            if(!job.current)return
            const next=job.current.sample(current,performance.now(),focused)
            if(next.kind!=='running')job.current=null
            if(next.kind==='failed')source.current=null
            setResult(next)
        }
        tick()
        const timer=setInterval(tick,50)
        return()=>{clearInterval(timer);job.current=null;source.current=null}
    },[open])
    useEffect(()=>{cancel()},[deadzone])
    const pad=pads.find(item=>String(item.index)===selected)??pads[0]
    const running=result?.kind==='running'
    const start=()=>{
        const current=readPads().find(item=>item.index===pad?.index&&item.id===pad?.id)
        if(!calibratable(current)||document.hidden||!document.hasFocus()){setResult({kind:'failed'});return}
        source.current={index:current.index,id:current.id}
        setSelected(String(current.index))
        job.current=new WebDeadzoneCalibration(current,performance.now())
        setResult({kind:'running',remaining:3})
    }
    const button='rounded border border-white/20 px-3 py-2 disabled:opacity-50'
    return <details className="w-full rounded border border-white/10 p-3" onToggle={event=>{setOpen(event.currentTarget.open);if(!event.currentTarget.open)cancel()}}>
        <summary className="cursor-pointer">Controller test and stick drift calibration</summary>
        {open&&<div className="grid gap-3 mt-3">
            <label>Controller <select className="bg-[#202020] rounded p-2" value={pad?.index??''} onChange={event=>{cancel();setSelected(event.target.value)}}>
                {pads.length===0&&<option value="">No controller detected</option>}
                {pads.map(item=><option key={item.index} value={item.index}>{item.index+1}: {item.id.slice(0,100)}</option>)}
            </select></label>
            {calibratable(pad)?<><div className="flex flex-wrap gap-6"><Stick label="Left stick" x={pad.axes[0]} y={pad.axes[1]} deadzone={deadzone}/><Stick label="Right stick" x={pad.axes[2]} y={pad.axes[3]} deadzone={deadzone}/></div>
                <p className="text-sm text-white/60">Leave both sticks untouched for three seconds. The suggested deadzone includes a small drift margin and applies to all local controllers for this session.</p>
            </>:<p className="text-sm text-white/60">Connect a standard-mapped gamepad with four valid stick axes. Press a controller button if the browser has not detected it.</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" className={button} disabled={!calibratable(pad)||running} onClick={start}>{running?'Measuring… '+result.remaining+'s':'Measure stick drift'}</button>
                <button type="button" className={button} disabled={!result} onClick={cancel}>Cancel</button>
                {result?.kind==='ready'&&<button type="button" className={button} onClick={()=>{const current=readPads();const selectedPad=current.find(item=>String(item.index)===selected)??current[0];if(source.current&&controllerConfirmationValid(source.current,selectedPad,current,!document.hidden&&document.hasFocus())){onApply(result.deadzone);cancel()}else{cancel();setResult({kind:'failed'})}}}>Apply {Math.round(result.deadzone*100)}% deadzone</button>}
            </div>
            {result?.kind==='ready'&&<p role="status">Recommended deadzone: {Math.round(result.deadzone*100)}%. Current: {Math.round(deadzone*100)}%.</p>}
            {result?.kind==='failed'&&<p role="alert">Measurement failed. Keep the controller connected, leave the sticks untouched, and keep this tab focused.</p>}
        </div>}
    </details>
}
