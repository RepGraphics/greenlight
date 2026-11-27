import {useEffect,useRef,useState} from 'react'
import {WebScreenWakeLock,type ScreenWakeState} from '../utils/webscreenwakelock'

export default function ScreenWakeControl(){
    const controller=useRef<WebScreenWakeLock|null>(null)
    const [supported,setSupported]=useState(false)
    const [enabled,setEnabled]=useState(false)
    const [state,setState]=useState<ScreenWakeState>('off')
    useEffect(()=>{
        const available=window.isSecureContext&&typeof navigator.wakeLock?.request==='function'
        setSupported(available)
        setEnabled(false)
        setState(available?'off':'unavailable')
        const current=new WebScreenWakeLock(available?()=>navigator.wakeLock.request('screen'):undefined,!document.hidden,setState)
        controller.current=current
        const visibility=()=>{void current.setVisible(!document.hidden)}
        document.addEventListener('visibilitychange',visibility)
        return()=>{
            document.removeEventListener('visibilitychange',visibility)
            controller.current=null
            current.dispose()
        }
    },[])
    const toggle=()=>{
        const next=!enabled
        setEnabled(next)
        void controller.current?.setEnabled(next)
    }
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    return <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className={button} disabled={!supported} aria-pressed={enabled} onClick={event=>{event.currentTarget.blur();toggle()}}>{enabled?'Allow screen sleep':'Keep screen awake'}</button>
        {enabled&&(state==='paused'||state==='failed')&&<button type="button" className={button} onClick={()=>void controller.current?.retry()}>Retry wake lock</button>}
        <span className="text-xs text-white/60" role="status">{state==='active'?'Screen wake lock active':state==='requesting'?'Requesting screen wake lock…':state==='paused'?'Screen wake lock paused':state==='failed'?'Wake lock denied or unavailable':state==='unavailable'?'Browser wake lock not supported':''}</span>
    </div>
}
