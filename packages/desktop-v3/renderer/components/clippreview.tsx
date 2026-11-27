import {useEffect,useRef,useState} from 'react'
import {supportsClipTrim,trimMaxSeconds,trimRange,type ClipTrimRange} from '../../../desktop/renderer/lib/cliptrim'
import type {WebClipTrimState} from '../utils/webcapture'

export default function ClipPreview({url,trim,onTrim,onCancel}:{
    url:string
    trim?:WebClipTrimState
    onTrim:(video:HTMLVideoElement,range:ClipTrimRange)=>void
    onCancel:()=>void
}){
    const video=useRef<HTMLVideoElement>(null)
    const [supported,setSupported]=useState(false)
    const [metadataReady,setMetadataReady]=useState(false)
    const [duration,setDuration]=useState<number|null>(null)
    const [start,setStart]=useState('0')
    const [end,setEnd]=useState('')
    useEffect(()=>{
        if(video.current)setSupported(supportsClipTrim(video.current))
    },[])

    const readDuration=()=>{
        const value=video.current?.duration
        if(typeof value!=='number'||!Number.isFinite(value)||value<=0)return
        setDuration(value)
        setEnd(current=>current||String(Math.min(30,value,trimMaxSeconds)))
    }
    const range=start.trim()&&end.trim()?trimRange(Number(start),Number(end),duration):null
    const maximum=Math.min(duration??trimMaxSeconds,trimMaxSeconds)
    const running=trim?.phase==='running'
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    const input='w-24 rounded border border-white/20 bg-[#202020] p-2 disabled:opacity-50'

    return <>
        <video ref={video} src={url} controls={!running} preload="metadata" playsInline className="max-w-full max-h-80" onLoadedMetadata={()=>{setMetadataReady(true);readDuration()}} onDurationChange={readDuration}/>
        {supported?<div className="my-3 rounded border border-white/10 p-3">
            <h3 className="font-semibold">Trim clip</h3>
            <p className="text-sm text-white/60 my-2">Choose a range of at least half a second. The preview plays the selection at normal speed while preparing a separate copy.</p>
            {duration===null&&<p className="text-sm text-white/60 my-2">Use the preview to find an end time.</p>}
            <div className="flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-sm">Start (seconds)<input className={input} type="number" min={0} max={maximum} step="any" value={start} onChange={event=>setStart(event.target.value)} disabled={running}/></label>
                <label className="grid gap-1 text-sm">End (seconds)<input className={input} type="number" min={.5} max={maximum} step="any" value={end} onChange={event=>setEnd(event.target.value)} disabled={running}/></label>
                <button type="button" className={button} disabled={running||!metadataReady||!range} onClick={()=>{if(video.current&&range)onTrim(video.current,range)}}>Prepare trimmed copy</button>
                {running&&<button type="button" className={button} onClick={onCancel}>Cancel trim</button>}
            </div>
            {trim?.phase==='running'&&<div className="mt-2">
                <p role="status">Preparing trimmed copy…</p>
                <progress aria-label="Clip trim progress" max={100} value={trim.progress}/>
            </div>}
            {trim?.phase==='failed'&&<p role="alert" className="mt-2">Could not prepare that range. Check the preview and try a shorter selection.</p>}
        </div>:<p className="my-2 text-sm">Clip trimming is unavailable in this browser.</p>}
    </>
}
