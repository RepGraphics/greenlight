import axios from 'axios'
import electron from 'electron'
import i18n from 'i18next'
import { selectForkRelease, forkReleaseApi } from './updaterelease'
import type { UpdateResult } from './updaterelease'

// Original notification code based on electron-update-notifier by @ankurk91.
interface Options {debug?:boolean;silent?:boolean;prereleases?:boolean}
const t=i18n.t.bind(i18n)
export const defaultOptions:Options={debug:false,silent:true,prereleases:false}
let pending:Promise<unknown>|undefined
let cached:{at:number;data:unknown}|undefined

export async function checkForkUpdates(includePrereleases=false):Promise<UpdateResult>{
    if(!cached||Date.now()-cached.at>60000){
        if(!pending){
            pending=axios.get(forkReleaseApi,{timeout:12000,maxRedirects:0,maxContentLength:2*1024*1024,headers:{Accept:'application/vnd.github+json'}}).then(response=>{
                if(!Array.isArray(response.data))throw Error('Invalid release response')
                cached={at:Date.now(),data:response.data}
                return response.data
            }).finally(()=>{pending=undefined})
        }
        await pending
    }
    return selectForkRelease(cached?.data,electron.app.getVersion(),includePrereleases)
}
export function setUpdateNotification(options:Options=defaultOptions,logger){
    const settings={...defaultOptions,...options}
    const run=()=>{void checkForUpdates(settings,logger)}
    if(electron.app.isReady())run()
    else electron.app.once('ready',run)
}
export async function checkForUpdates({debug,silent,prereleases}:Options=defaultOptions,logger){
    if(!electron.app.isPackaged&&!debug)return
    try{
        const result=await checkForkUpdates(prereleases===true)
        if(result.status==='available'&&result.release){
            const {release}=result
            const {response}=await electron.dialog.showMessageBox({
                title:electron.app.getName(),type:'info',message:t('updater.newReleaseAvailable'),
                detail:`${t('updater.installedVersion')} ${result.installed}\n${t('updater.latestVersion')} ${release.tag}\n\n${release.notes}`,
                buttons:[t('updater.downloadBtn'),t('updater.laterBtn')],defaultId:0,cancelId:1
            })
            if(response===0)await electron.shell.openExternal(release.url)
        }else if(!silent){
            await electron.dialog.showMessageBox({title:electron.app.getName(),message:t(result.status==='none'?'updater.noReleases':'updater.alreadyOnLatestVersion'),buttons:[t('updater.closeBtn')]})
        }
    }catch{
        logger.log('updater','Unable to check for fork updates')
        if(!silent)await electron.dialog.showMessageBox({title:electron.app.getName(),type:'error',message:t('updater.unableToCheckForUpdates')}).catch(()=>{})
    }
}
