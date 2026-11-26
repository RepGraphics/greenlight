import {useEffect,useRef,useState} from 'react'
import {webBindingTargets,updateWebBinding,readBindingPads,WebButtonListener,type BindingPad} from '../utils/webbuttonbindings'
import {defaultButtonMapping} from '../../../player/src/client/lib/input/mapping'

type Status='idle'|'waiting'|'ambiguous'|'ready'|'failed'
const readPads=()=>{
    try{return readBindingPads(Array.from(navigator.getGamepads?.()??[]))}catch{return []}
}
export default function ControllerBindings({mapping,onChange}:{mapping:Record<string,string>;onChange:(mapping:Record<string,string>)=>void}){
    const [open,setOpen]=useState(false)
    const [target,setTarget]=useState('A')
    const [pads,setPads]=useState<BindingPad[]>([])
    const [selected,setSelected]=useState('')
    const [status,setStatus]=useState<Status>('idle')
    const [candidate,setCandidate]=useState<string|null>(null)
    const listener=useRef<WebButtonListener|null>(null)
    const cancel=()=>{listener.current=null;setCandidate(null);setStatus('idle')}
    useEffect(()=>{
        if(!open)return
        const tick=()=>{
            const current=readPads()
            setPads(current)
            const job=listener.current
            if(!job)return
            const result=job.sample(current,performance.now(),!document.hidden&&document.hasFocus())
            if(result.kind==='captured'){
                listener.current=null;setCandidate(String(result.index));setStatus('ready')
            }else{
                if(result.kind==='failed')listener.current=null
                setStatus(result.kind)
            }
        }
        tick()
        const timer=setInterval(tick,50)
        return()=>{clearInterval(timer);listener.current=null}
    },[open])
    useEffect(()=>{cancel()},[mapping])
    const pad=pads.find(item=>String(item.index)===selected)??pads[0]
    const listening=status==='waiting'||status==='ambiguous'
    const button='rounded border border-white/20 px-3 py-2 disabled:opacity-50'
    const start=()=>{
        const current=readPads().find(item=>item.index===pad?.index&&item.id===pad?.id)
        if(!current||document.hidden||!document.hasFocus()){setStatus('failed');return}
        setCandidate(null);setStatus('waiting');listener.current=new WebButtonListener(current,performance.now()+10000)
    }
    return <details className="w-full rounded border border-white/10 p-3" onToggle={event=>{setOpen(event.currentTarget.open);if(!event.currentTarget.open)cancel()}}>
        <summary className="cursor-pointer">Custom button mappings</summary>
        {open&&<div className="grid gap-3 mt-3">
            <p className="text-sm text-white/60">Choose an Xbox button, then a physical button index (0–63), or listen for a press. Mappings apply to all local physical controllers for this session. Multiple Xbox buttons may share an index.</p>
            <div className="flex flex-wrap gap-3 items-center">
                <label>Xbox button <select className="bg-[#202020] rounded p-2" value={target} onChange={event=>{cancel();setTarget(event.target.value)}}>{webBindingTargets.map(key=><option key={key} value={key}>{key==='Nexus'?'Guide':key}</option>)}</select></label>
                <label>Physical button index <select className="bg-[#202020] rounded p-2" value={candidate??mapping[target]??defaultButtonMapping[target]} onChange={event=>{listener.current=null;setCandidate(event.target.value);setStatus('ready')}}>{Array.from({length:64},(_,index)=><option key={index} value={index}>{index}</option>)}</select></label>
                <button type="button" className={button} disabled={candidate===null||listening} onClick={()=>{if(candidate!==null)onChange(updateWebBinding(mapping,target,candidate));cancel()}}>Apply mapping</button>
                <button type="button" className={button} onClick={()=>{onChange(updateWebBinding(mapping,target,defaultButtonMapping[target]));cancel()}}>Reset selected button</button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
                <label>Controller <select className="bg-[#202020] rounded p-2" value={pad?.index??''} onChange={event=>{cancel();setSelected(event.target.value)}}>{pads.length===0&&<option value="">No controller detected</option>}{pads.map(item=><option key={item.index} value={item.index}>{item.index+1}: {item.id.slice(0,100)}</option>)}</select></label>
                <button type="button" className={button} disabled={!pad||listening} onClick={start}>Listen for button</button>
                <button type="button" className={button} disabled={status==='idle'} onClick={cancel}>Cancel</button>
            </div>
            <p role="status" className="text-sm">{status==='waiting'?'Release held buttons, then press one button within 10 seconds.':status==='ambiguous'?'Multiple buttons detected. Release all buttons and try one at a time.':status==='ready'?'Confirm the proposed mapping using Apply mapping.':status==='failed'?'Listening ended. Check focus and controller connection, then retry.':'Press a controller button to make it detectable if needed.'}</p>
            <div className="flex flex-wrap gap-2 text-xs">{webBindingTargets.map(key=><span key={key} className="rounded bg-white/10 px-2 py-1">{key}: {mapping[key]}</span>)}</div>
        </div>}
    </details>
}
