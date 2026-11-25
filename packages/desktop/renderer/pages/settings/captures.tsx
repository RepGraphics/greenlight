import React from 'react'
import Head from 'next/head'
import Card from '../../components/ui/card'
import SettingsSidebar from '../../components/settings/sidebar'
import { listCaptures,getCapture,storeCapture,deleteCapture,renameCapture,downloadCapture,captureLimitBytes,captureLimitCount,filterCaptures,deleteCaptures,visibleCaptureSelection } from '../../lib/capturelibrary'
import type { CaptureInfo,CaptureSort } from '../../lib/capturelibrary'
import { useTranslation } from 'react-i18next'
import Ipc from '../../lib/ipc'
import ClipEditor from '../../components/settings/clipeditor'

export default function Captures(){
    const {t}=useTranslation()
    const [entries,setEntries]=React.useState<CaptureInfo[]>([])
    const [filter,setFilter]=React.useState('all')
    const [query,setQuery]=React.useState('')
    const [sort,setSort]=React.useState<CaptureSort>('newest')
    const [busy,setBusy]=React.useState(true)
    const operation=React.useRef(true)
    const [selection,setSelection]=React.useState<Set<string>>(()=>new Set())
    const [error,setError]=React.useState(false)
    const [desktop,setDesktop]=React.useState(false)
    const [directory,setDirectory]=React.useState<string|null>(null)
    const [exportProgress,setExportProgress]=React.useState<{saved:number;total:number}|null>(null)
    const [preview,setPreview]=React.useState<{url:string;kind:CaptureInfo['kind'];name:string}|null>(null)
    const previewUrl=React.useRef('')
    const mounted=React.useRef(false)
    const closePreview=()=>{if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current='';setPreview(null)}
    const refresh=async()=>{try{const list=await listCaptures();if(mounted.current){setEntries(list);setSelection(previous=>new Set([...previous].filter(id=>list.some(item=>item.id===id))));setError(false)}}catch{if(mounted.current)setError(true)}finally{operation.current=false;if(mounted.current)setBusy(false)}}
    React.useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;if(previewUrl.current)URL.revokeObjectURL(previewUrl.current)}},[])
    React.useEffect(()=>{
        let disposed=false
        const local=window.Greenlight?.isWebUI()===false
        setDesktop(local)
        if(local)void Ipc.send('app','getCaptureDirectory').then(value=>{if(!disposed)setDirectory(typeof value==='string'?value:null)}).catch(()=>{})
        return()=>{disposed=true}
    },[])
    const chooseDirectory=async(clear=false)=>{
        if(operation.current||!desktop)return
        operation.current=true;setBusy(true);setError(false);setExportProgress(null)
        try{const value=await Ipc.send('app',clear?'clearCaptureDirectory':'chooseCaptureDirectory');if(mounted.current)setDirectory(typeof value==='string'?value:null)}
        catch{if(mounted.current)setError(true)}finally{operation.current=false;if(mounted.current)setBusy(false)}
    }
    const act=async(entry:CaptureInfo,action:'preview'|'download'|'delete'|'rename')=>{
        if(operation.current)return
        if(action==='delete'&&!window.confirm(t('dashboard.captureDeleteConfirm')))return
        const name=action==='rename'?window.prompt(t('dashboard.captureRename'),entry.name):null
        if(action==='rename'&&name===null)return
        operation.current=true;setBusy(true);setError(false)
        try{
            if(action==='rename'){await renameCapture(entry.id,name);closePreview();await refresh()}
            else if(action==='delete'){closePreview();await deleteCapture(entry.id);await refresh()}
            else{const capture=await getCapture(entry.id);if(!capture)throw new Error('Missing capture');if(!mounted.current)return;if(action==='download')downloadCapture(capture.blob,capture.name);else{closePreview();previewUrl.current=URL.createObjectURL(capture.blob);setPreview({url:previewUrl.current,kind:capture.kind,name:capture.name})}}
        }catch{if(mounted.current)setError(true)}finally{operation.current=false;if(mounted.current)setBusy(false)}
    }
    const saveTrimmed=async(blob:Blob)=>{if(!mounted.current)throw Error('Capture library closed');await storeCapture('clip',blob);if(mounted.current)await refresh()}
    const beginTrim=()=>{if(operation.current)return false;operation.current=true;setBusy(true);setError(false);return true}
    const finishTrim=()=>{operation.current=false;if(mounted.current)setBusy(false)}
    const total=entries.reduce((sum,item)=>sum+item.size,0)
    const visible=filterCaptures(entries,filter,query,sort)
    const selected=visibleCaptureSelection(visible,selection)
    const selectedBytes=selected.reduce((sum,item)=>sum+item.size,0)
    const toggleSelection=(id:string)=>setSelection(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next})
    const selectVisible=()=>setSelection(new Set(visible.map(item=>item.id)))
    const exportSelected=async()=>{
        if(operation.current||!desktop||!directory||!selected.length)return
        operation.current=true;setBusy(true);setError(false);setExportProgress({saved:0,total:selected.length})
        let saved=0
        try{
            for(const item of selected){
                if(!mounted.current)break
                const capture=await getCapture(item.id)
                if(!capture)throw Error('Missing capture')
                const bytes=new Uint8Array(await capture.blob.arrayBuffer())
                if(!mounted.current)break
                await Ipc.send('app','exportCapture',{name:capture.name,kind:capture.kind,bytes})
                saved++
                if(mounted.current)setExportProgress({saved,total:selected.length})
            }
        }catch{if(mounted.current)setError(true)}finally{operation.current=false;if(mounted.current)setBusy(false)}
    }
    const deleteSelected=async()=>{
        if(operation.current||!selected.length||!window.confirm(t('dashboard.captureDeleteSelectedConfirm',{count:selected.length})))return
        operation.current=true;setBusy(true);setError(false)
        try{await deleteCaptures(selected.map(item=>item.id));if(mounted.current){closePreview();setSelection(new Set());await refresh()}}
        catch{if(mounted.current)setError(true)}finally{operation.current=false;if(mounted.current)setBusy(false)}
    }
    return <><Head><title>Greenlight - {t('dashboard.captureLibrary')}</title></Head><SettingsSidebar><Card><h1>{t('dashboard.captureLibrary')}</h1><p>{t('dashboard.captureLibraryDescription')}</p><p>{entries.length} / {captureLimitCount} · {(total/1048576).toFixed(1)} / {captureLimitBytes/1048576} MiB</p><progress value={total} max={captureLimitBytes}/><p><label htmlFor='capture-filter'>{t('dashboard.historyFilter')}</label><select id='capture-filter' value={filter} onChange={e=>{setFilter(e.target.value);setSelection(new Set())}}><option value='all'>{t('dashboard.historyAll')}</option><option value='screenshot'>{t('dashboard.screenshot')}</option><option value='clip'>{t('dashboard.clipReady')}</option></select></p><p><label htmlFor='capture-search'>{t('dashboard.captureSearch')}</label><input id='capture-search' className='text' value={query} onChange={e=>{setQuery(e.target.value);setSelection(new Set())}} maxLength={80}/></p><p><label htmlFor='capture-sort'>{t('dashboard.captureSort')}</label><select id='capture-sort' value={sort} onChange={e=>setSort(e.target.value as CaptureSort)}>{(['newest','oldest','largest','name'] as CaptureSort[]).map(value=><option key={value} value={value}>{t('dashboard.captureSort_'+value)}</option>)}</select></p>{error&&<p role='alert'>{t('dashboard.captureLibraryFailed')}</p>}<button type='button' className='btn' disabled={busy} onClick={()=>{if(operation.current)return;operation.current=true;setBusy(true);void refresh()}}>{t('dashboard.refresh')}</button></Card>
    {desktop&&<Card><h2>{t('dashboard.captureExportFolder')}</h2><p>{t('dashboard.captureExportFolderHint')}</p><p style={{overflowWrap:'anywhere'}}>{directory??t('dashboard.captureNoFolder')}</p><div className='gl-console-toolbar'><button type='button' className='btn' disabled={busy} onClick={()=>void chooseDirectory()}>{t('dashboard.captureChooseFolder')}</button><button type='button' className='btn' disabled={busy||!directory} onClick={()=>void chooseDirectory(true)}>{t('dashboard.captureClearFolder')}</button><button type='button' className='btn btn-primary' disabled={busy||!directory||!selected.length} onClick={()=>void exportSelected()}>{t('dashboard.captureExportSelected')}</button></div>{exportProgress&&<p role='status'>{t('dashboard.captureExportProgress',exportProgress)}</p>}</Card>}
    {preview&&<Card><h2>{preview.name}</h2>{preview.kind==='screenshot'?<img src={preview.url} alt={preview.name} className='gl-capture-preview'/>:<ClipEditor key={preview.url} url={preview.url} busy={busy} onBegin={beginTrim} onFinish={finishTrim} onSave={saveTrimmed}/>}<button className='btn' disabled={busy} onClick={closePreview}>{t('dashboard.dismiss')}</button></Card>}
    <Card><div className='gl-console-toolbar'><button type='button' className='btn' disabled={busy||!visible.length} onClick={selectVisible}>{t('dashboard.captureSelectVisible')}</button><button type='button' className='btn' disabled={busy||!selection.size} onClick={()=>setSelection(new Set())}>{t('dashboard.captureClearSelection')}</button><button type='button' className='btn btn-cancel' disabled={busy||!selected.length} onClick={()=>void deleteSelected()}>{t('dashboard.captureDeleteSelected')}</button><span role='status'>{t('dashboard.captureSelectionCount',{count:selected.length})} · {(selectedBytes/1048576).toFixed(2)} MiB</span></div>{!visible.length?<p>{t('dashboard.captureLibraryEmpty')}</p>:<div className='gl-capture-list'>{visible.map(item=><div key={item.id} className='gl-capture-item'><div><label style={{minWidth:0}}><input type='checkbox' disabled={busy} checked={selection.has(item.id)} aria-label={t('dashboard.captureSelectItem',{name:item.name})} onChange={()=>toggleSelection(item.id)}/></label> <strong>{item.kind==='screenshot'?t('dashboard.screenshot'):t('dashboard.clipReady')}</strong><p>{item.name}</p><p>{new Date(item.createdAt).toLocaleString()} · {(item.size/1048576).toFixed(2)} MiB</p></div><div className='gl-console-toolbar'><button className='btn' disabled={busy} onClick={()=>void act(item,'preview')}>{t('dashboard.capturePreview')}</button><button className='btn' disabled={busy} onClick={()=>void act(item,'download')}>{t('dashboard.captureDownload')}</button><button className='btn' disabled={busy} onClick={()=>void act(item,'rename')}>{t('dashboard.captureRename')}</button><button className='btn btn-cancel' disabled={busy} onClick={()=>void act(item,'delete')}>{t('dashboard.captureDelete')}</button></div></div>)}</div>}</Card></SettingsSidebar></>
}
