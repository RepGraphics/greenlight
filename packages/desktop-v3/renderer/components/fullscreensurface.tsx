import {useEffect,useRef,useState,type ReactNode} from 'react'
import ScreenWakeControl from './screenwakecontrol'
import {WebFullscreen} from '../utils/webfullscreen'

export default function FullscreenSurface({children,enabled,fullscreenActions}:{children:ReactNode;enabled:boolean;fullscreenActions?:ReactNode}){
    const surface=useRef<HTMLDivElement|null>(null)
    const controller=useRef<WebFullscreen|null>(null)
    const [state,setState]=useState({active:false,available:false,busy:false})
    const [error,setError]=useState(false)
    useEffect(()=>{
        setError(false)
        if(!surface.current){setState({active:false,available:false,busy:false});return}
        const current=new WebFullscreen(document,surface.current)
        controller.current=current
        current.setEnabled(enabled)
        const refresh=()=>setState(current.state())
        document.addEventListener('fullscreenchange',refresh)
        refresh()
        return()=>{
            document.removeEventListener('fullscreenchange',refresh)
            controller.current=null
            current.dispose()
        }
    },[])
    useEffect(()=>{
        const current=controller.current
        if(current){current.setEnabled(enabled);setState(current.state())}
    },[enabled])
    const toggle=async()=>{
        const current=controller.current
        if(!current)return
        setError(false)
        setState({...current.state(),busy:true})
        try{await current.toggle()}
        catch{if(controller.current===current)setError(true)}
        finally{if(controller.current===current)setState(current.state())}
    }
    return <div ref={surface} className="web-fullscreen-surface">
        <div className="web-fullscreen-content">{children}</div>
        {enabled&&<div className="web-fullscreen-toolbar">
            <button type="button" className="rounded border border-white/20 px-4 py-2 disabled:opacity-50" disabled={!state.available||state.busy} aria-pressed={state.active} onClick={event=>{event.currentTarget.blur();void toggle()}}>{state.active?'Exit fullscreen':'Fullscreen'}</button>
            <ScreenWakeControl/>
            {state.active&&fullscreenActions&&<details className="web-fullscreen-actions"><summary>Playback controls</summary><div className="flex flex-wrap justify-center gap-2 pt-2">{fullscreenActions}</div></details>}
            {error&&<p role="alert" className="text-sm">Fullscreen could not be changed. Check browser support.</p>}
            {!state.available&&!state.active&&<p className="text-sm text-white/60">Browser fullscreen unavailable. The Android companion has its own fullscreen control.</p>}
        </div>}
    </div>
}
