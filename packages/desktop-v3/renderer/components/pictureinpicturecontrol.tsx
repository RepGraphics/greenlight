import {useEffect,useRef,useState} from 'react'
import {WebPictureInPicture} from '../utils/webpictureinpicture'

export default function PictureInPictureControl({surface}:{surface:()=>HTMLElement|null}){
    const controller=useRef<WebPictureInPicture|null>(null)
    const [available,setAvailable]=useState(false)
    const [active,setActive]=useState(false)
    const [busy,setBusy]=useState(false)
    const [error,setError]=useState(false)
    const surfaceRef=useRef(surface)
    surfaceRef.current=surface
    const video=()=>surfaceRef.current()?.querySelector<HTMLVideoElement>('#playerContainer video')??null
    useEffect(()=>{
        const current=new WebPictureInPicture(document)
        controller.current=current
        const refresh=()=>{
            const state=current.state(video())
            setAvailable(state.available);setActive(state.active);setBusy(state.busy)
        }
        refresh()
        const timer=setInterval(refresh,500)
        return()=>{clearInterval(timer);controller.current=null;current.dispose()}
    },[])
    const toggle=async()=>{
        const current=controller.current
        if(!current)return
        setError(false);setBusy(true)
        try{await current.toggle(video())}
        catch{if(controller.current===current)setError(true)}
        finally{
            if(controller.current===current){
                const state=current.state(video())
                setAvailable(state.available);setActive(state.active);setBusy(state.busy)
            }
        }
    }
    return <div className="my-2">
        <button type="button" className="rounded border border-white/20 px-4 py-2 disabled:opacity-50" disabled={!available||busy} aria-pressed={active} onClick={()=>void toggle()}>{active?'Exit picture-in-picture':'Picture-in-picture'}</button>
        {error&&<p role="alert" className="text-sm">Picture-in-picture could not be changed. Check browser support or close another picture-in-picture video.</p>}
        {!available&&!active&&<p className="text-sm text-white/60">Picture-in-picture requires decoded video and browser support.</p>}
    </div>
}
