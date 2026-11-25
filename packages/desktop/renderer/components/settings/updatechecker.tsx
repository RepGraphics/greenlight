import React from 'react'
import {useTranslation} from 'react-i18next'
import Card from '../ui/card'
import Ipc from '../../lib/ipc'
import type {UpdateResult} from '../../../main/helpers/updaterelease'

export default function UpdateChecker(){
    const {t}=useTranslation()
    const [prereleases,setPrereleases]=React.useState(false)
    const [busy,setBusy]=React.useState(false)
    const [error,setError]=React.useState(false)
    const [result,setResult]=React.useState<UpdateResult|null>(null)
    const [desktop,setDesktop]=React.useState(false)
    const mounted=React.useRef(false)
    const locked=React.useRef(false)
    React.useEffect(()=>{mounted.current=true;setDesktop(window.Greenlight?.isWebUI()===false);return()=>{mounted.current=false}},[])
    const check=async()=>{
        if(locked.current)return
        locked.current=true;setBusy(true);setError(false);setResult(null)
        try{const value=await Ipc.send('app','checkForUpdates',{includePrereleases:prereleases});if(mounted.current)setResult(value)}
        catch{if(mounted.current)setError(true)}
        finally{locked.current=false;if(mounted.current)setBusy(false)}
    }
    if(!desktop)return null
    return <Card><h1>{t('updater.updateChecker')}</h1><p>{t('updater.manualUpdateHint')}</p>
        <p><label htmlFor='update-prerelease'>{t('updater.includePrereleases')}</label><input id='update-prerelease' type='checkbox' disabled={busy} checked={prereleases} onChange={event=>{setPrereleases(event.target.checked);setResult(null);setError(false)}}/></p>
        <button type='button' className='btn' disabled={busy} onClick={()=>void check()}>{t(busy?'dashboard.refreshing':'updater.manualCheck')}</button>
        {error&&<p role='alert'>{t('updater.unableToCheckForUpdates')}</p>}
        {result&&<div role='status'><p>{t('updater.installedVersion')} {result.installed}</p><p>{t(result.status==='available'?'updater.newReleaseAvailable':result.status==='none'?'updater.noReleases':'updater.alreadyOnLatestVersion')}</p>
            {result.release&&<><p>{t('updater.latestVersion')} {result.release.tag}</p><button type='button' className='btn' onClick={()=>window.Greenlight.openExternal(result.release!.url)}>{t('updater.downloadBtn')}</button>
                {result.release.notes&&<details><summary>{t('updater.releaseNotes')}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{result.release.notes}</pre></details>}</>}
        </div>}
    </Card>
}
