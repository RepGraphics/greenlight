import React from 'react'
import Head from 'next/head'
import Card from '../../components/ui/card'
import SettingsSidebar from '../../components/settings/sidebar'
import { listCaptures,getCapture,deleteCapture,renameCapture,downloadCapture,captureLimitBytes,captureLimitCount } from '../../lib/capturelibrary'
import type { CaptureInfo } from '../../lib/capturelibrary'
import { useTranslation } from 'react-i18next'

export default function Captures(){
    const {t}=useTranslation()
    const [entries,setEntries]=React.useState<CaptureInfo[]>([])
    const [filter,setFilter]=React.useState('all')
    const [busy,setBusy]=React.useState(true)
    const [error,setError]=React.useState(false)
    const [preview,setPreview]=React.useState<{url:string;kind:CaptureInfo['kind'];name:string}|null>(null)
    const previewUrl=React.useRef('')
    const mounted=React.useRef(false)
    const closePreview=()=>{if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current='';setPreview(null)}
    const refresh=async()=>{try{const list=await listCaptures();if(mounted.current){setEntries(list);setError(false)}}catch{if(mounted.current)setError(true)}finally{if(mounted.current)setBusy(false)}}
    React.useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;if(previewUrl.current)URL.revokeObjectURL(previewUrl.current)}},[])
    const act=async(entry:CaptureInfo,action:'preview'|'download'|'delete'|'rename')=>{
        if(busy)return
        if(action==='delete'&&!window.confirm(t('dashboard.captureDeleteConfirm')))return
        const name=action==='rename'?window.prompt(t('dashboard.captureRename'),entry.name):null
        if(action==='rename'&&name===null)return
        setBusy(true);setError(false)
        try{
            if(action==='rename'){await renameCapture(entry.id,name);closePreview();await refresh()}
            else if(action==='delete'){closePreview();await deleteCapture(entry.id);await refresh()}
            else{const capture=await getCapture(entry.id);if(!capture)throw new Error('Missing capture');if(!mounted.current)return;if(action==='download')downloadCapture(capture.blob,capture.name);else{closePreview();previewUrl.current=URL.createObjectURL(capture.blob);setPreview({url:previewUrl.current,kind:capture.kind,name:capture.name})}}
        }catch{if(mounted.current)setError(true)}finally{if(mounted.current)setBusy(false)}
    }
    const total=entries.reduce((sum,item)=>sum+item.size,0)
    const visible=entries.filter(item=>filter==='all'||item.kind===filter)
    return <><Head><title>Greenlight - {t('dashboard.captureLibrary')}</title></Head><SettingsSidebar><Card><h1>{t('dashboard.captureLibrary')}</h1><p>{t('dashboard.captureLibraryDescription')}</p><p>{entries.length} / {captureLimitCount} · {(total/1048576).toFixed(1)} / {captureLimitBytes/1048576} MiB</p><progress value={total} max={captureLimitBytes}/><p><label htmlFor='capture-filter'>{t('dashboard.historyFilter')}</label><select id='capture-filter' value={filter} onChange={e=>setFilter(e.target.value)}><option value='all'>{t('dashboard.historyAll')}</option><option value='screenshot'>{t('dashboard.screenshot')}</option><option value='clip'>{t('dashboard.clipReady')}</option></select></p>{error&&<p role='alert'>{t('dashboard.captureLibraryFailed')}</p>}<button type='button' className='btn' disabled={busy} onClick={()=>{setBusy(true);void refresh()}}>{t('dashboard.retryStream')}</button></Card>
    {preview&&<Card><h2>{preview.name}</h2>{preview.kind==='screenshot'?<img src={preview.url} alt={preview.name} className='gl-capture-preview'/>:<video src={preview.url} controls playsInline className='gl-capture-preview'/>}<button className='btn' onClick={closePreview}>{t('dashboard.dismiss')}</button></Card>}
    <Card>{!visible.length?<p>{t('dashboard.captureLibraryEmpty')}</p>:<div className='gl-capture-list'>{visible.map(item=><div key={item.id} className='gl-capture-item'><div><strong>{item.kind==='screenshot'?t('dashboard.screenshot'):t('dashboard.clipReady')}</strong><p>{item.name}</p><p>{new Date(item.createdAt).toLocaleString()} · {(item.size/1048576).toFixed(2)} MiB</p></div><div className='gl-console-toolbar'><button className='btn' disabled={busy} onClick={()=>void act(item,'preview')}>{t('dashboard.capturePreview')}</button><button className='btn' disabled={busy} onClick={()=>void act(item,'download')}>{t('dashboard.captureDownload')}</button><button className='btn' disabled={busy} onClick={()=>void act(item,'rename')}>{t('dashboard.captureRename')}</button><button className='btn btn-cancel' disabled={busy} onClick={()=>void act(item,'delete')}>{t('dashboard.captureDelete')}</button></div></div>)}</div>}</Card></SettingsSidebar></>
}
