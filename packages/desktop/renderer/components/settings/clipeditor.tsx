import React from 'react'
import {useTranslation} from 'react-i18next'
import {supportsClipTrim,trimClip,trimRange,trimMaxSeconds} from '../../lib/cliptrim'

export default function ClipEditor({url,busy,onBegin,onFinish,onSave}:{url:string;busy:boolean;onBegin:()=>boolean;onFinish:()=>void;onSave:(blob:Blob)=>Promise<void>}){
    const {t}=useTranslation()
    const video=React.useRef<HTMLVideoElement>(null)
    const active=React.useRef<AbortController|null>(null)
    const mounted=React.useRef(false)
    const [duration,setDuration]=React.useState<number|null>(null)
    const [supported,setSupported]=React.useState(false)
    const [start,setStart]=React.useState('0')
    const [end,setEnd]=React.useState('30')
    const [progress,setProgress]=React.useState<number|null>(null)
    const [message,setMessage]=React.useState('')
    React.useEffect(()=>{mounted.current=true;setSupported(Boolean(video.current&&supportsClipTrim(video.current)));return()=>{mounted.current=false;active.current?.abort()}},[])
    const metadata=()=>{
        const value=video.current?.duration
        if(typeof value==='number'&&Number.isFinite(value)&&value>0){setDuration(value);setEnd(previous=>String(Math.min(Number(previous)||30,value,trimMaxSeconds)))}
    }
    const range=start.trim()&&end.trim()?trimRange(Number(start),Number(end),duration):null
    const save=async()=>{
        if(!range||!video.current||active.current||!onBegin())return
        const controller=new AbortController();active.current=controller
        setMessage('');setProgress(0)
        try{
            const blob=await trimClip(video.current,range,controller.signal,value=>{if(mounted.current)setProgress(value)})
            if(controller.signal.aborted||!mounted.current)return
            await onSave(blob)
            if(mounted.current)setMessage('clipTrimSaved')
        }catch{if(mounted.current&&!controller.signal.aborted)setMessage('clipTrimFailed')}
        finally{active.current=null;if(mounted.current){setProgress(null);onFinish()}}
    }
    return <><video ref={video} src={url} controls={progress===null} playsInline className='gl-capture-preview' onLoadedMetadata={metadata} onDurationChange={metadata}/>
        <h3>{t('dashboard.clipTrimTitle')}</h3>
        {!supported?<p>{t('dashboard.clipTrimUnsupported')}</p>:<>
            <p>{t('dashboard.clipTrimHint')}</p>
            {duration===null&&<p>{t('dashboard.clipTrimUnknown')}</p>}
            <p><label htmlFor='clip-trim-start'>{t('dashboard.clipTrimStart')}</label><input id='clip-trim-start' type='number' min={0} max={Math.min(duration??trimMaxSeconds,trimMaxSeconds)} step={.1} value={start} disabled={busy} onChange={event=>setStart(event.target.value)}/></p>
            <p><label htmlFor='clip-trim-end'>{t('dashboard.clipTrimEnd')}</label><input id='clip-trim-end' type='number' min={.5} max={Math.min(duration??trimMaxSeconds,trimMaxSeconds)} step={.1} value={end} disabled={busy} onChange={event=>setEnd(event.target.value)}/></p>
            <button type='button' className='btn btn-primary' disabled={busy||!range} onClick={()=>void save()}>{t('dashboard.clipTrimSave')}</button>
            {progress!==null&&<><button type='button' className='btn' onClick={()=>active.current?.abort()}>{t('dashboard.cancelBackup')}</button><p role='status'>{t('dashboard.clipTrimProgress',{percent:progress})}</p><progress value={progress} max={100}/></>}
            {message&&<p role={message==='clipTrimFailed'?'alert':'status'}>{t('dashboard.'+message)}</p>}
        </>}
    </>
}
