import {createHash} from 'node:crypto'
import {constants} from 'node:fs'
import {mkdtemp,open,link,rm,lstat} from 'node:fs/promises'
import {join,basename} from 'node:path'
import type {ForkInstaller} from './updaterelease'
import {maximumInstallerBytes} from './updaterelease'

export type UpdateDownloadStatus={phase:'idle'|'choosing'|'downloading'|'ready'|'cancelled'|'failed';received:number;total:number;name?:string}
const safeAssetHost=(url:URL)=>url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&
    ['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com'].includes(url.hostname)
export function validInstallerRedirect(value:string,previous:string){
    const url=new URL(value,previous)
    if(!safeAssetHost(url)||(url.hostname==='github.com'&&!url.pathname.startsWith('/RepGraphics/greenlight/releases/download/')))throw Error('Invalid installer redirect')
    return url.href
}
export async function downloadVerifiedInstaller(asset:ForkInstaller,directory:string,signal:AbortSignal,onProgress:(bytes:number)=>void=()=>{},request:typeof fetch=fetch){
    if(!/^(windows|linux|macos)-[A-Za-z0-9][A-Za-z0-9 ._+-]{0,170}\.(exe|AppImage|dmg)$/i.test(asset.name)||!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>maximumInstallerBytes||!/^[a-f0-9]{64}$/.test(asset.sha256))throw Error('Invalid installer metadata')
    const initial=new URL(asset.url)
    if(initial.hostname!=='github.com'||!safeAssetHost(initial)||!initial.pathname.startsWith('/RepGraphics/greenlight/releases/download/')||initial.search||initial.hash||decodeURIComponent(initial.pathname.split('/').at(-1)!)!==asset.name)throw Error('Invalid installer URL')
    const bounded=AbortSignal.any([signal,AbortSignal.timeout(10*60*1000)])
    bounded.throwIfAborted()
    // Reserve the destination filesystem before requesting the asset. Keep
    // all response and file resources inside a single cleanup boundary.
    const temp=await mkdtemp(join(directory,'.streamcloud-update-'))
    const partial=join(temp,'installer.part'),destination=join(directory,asset.name)
    let handle:Awaited<ReturnType<typeof open>>|undefined
    let response:Response|undefined
    let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
    try{
        let url=initial.href
        for(let i=0;i<5;i++){
            bounded.throwIfAborted()
            response=await request(url,{redirect:'manual',signal:bounded,headers:{Accept:'application/octet-stream'}})
            if(![301,302,303,307,308].includes(response.status))break
            const location=response.headers.get('location')
            await response.body?.cancel()
            response=undefined
            if(!location)throw Error('Missing installer redirect')
            url=validInstallerRedirect(location,url)
        }
        if(!response?.ok||!response.body)throw Error('Installer download failed')
        const length=response.headers.get('content-length')
        if(length!==null&&Number(length)!==asset.size)throw Error('Unexpected installer size')
        reader=response.body.getReader()
        const hash=createHash('sha256')
        let received=0
        handle=await open(partial,'wx',0o600)
        while(true){
            bounded.throwIfAborted()
            const {done,value}=await reader.read()
            if(done)break
            received+=value.byteLength
            if(received>asset.size)throw Error('Installer exceeds expected size')
            hash.update(value)
            await handle.writeFile(value)
            onProgress(received)
        }
        if(received!==asset.size||hash.digest('hex')!==asset.sha256)throw Error('Installer checksum mismatch')
        bounded.throwIfAborted()
        // AppImages require the owner execute bit. Never execute a download
        // automatically, and never grant group/other execute permissions.
        if(process.platform==='linux'&&/^linux-.*\.AppImage$/i.test(asset.name))await handle.chmod(0o700)
        await handle.sync();await handle.close();handle=undefined
        bounded.throwIfAborted()
        // Publish only a verified file. An existing destination is never
        // overwritten; the temporary file lives on the same filesystem.
        await link(partial,destination)
        return destination
    }finally{
        if(reader){
            await reader.cancel().catch(()=>{});reader.releaseLock()
        }else await response?.body?.cancel().catch(()=>{})
        await handle?.close().catch(()=>{})
        await rm(temp,{recursive:true,force:true}).catch(()=>{})
    }
}

// Recheck a saved installer immediately before handing it back to the user.
// This detects modifications since download; it is not code signing, and
// the file can still change after being revealed in the OS file manager.
export async function verifySavedInstaller(file:string,asset:ForkInstaller){
    if(!Number.isSafeInteger(asset.size)||asset.size<=0||asset.size>maximumInstallerBytes||!/^[a-f0-9]{64}$/.test(asset.sha256)||basename(file)!==asset.name)throw Error('Invalid installer metadata')
    const before=await lstat(file)
    if(!before.isFile()||before.size!==asset.size)throw Error('Saved installer changed')
    const flags=constants.O_RDONLY|(process.platform==='win32'?0:constants.O_NOFOLLOW|constants.O_NONBLOCK)
    const handle=await open(file,flags)
    const matches=(value:Awaited<ReturnType<typeof lstat>>)=>value.isFile()&&value.dev===before.dev&&value.ino===before.ino&&value.size===before.size&&value.mtimeMs===before.mtimeMs&&value.ctimeMs===before.ctimeMs
    try{
        if(!matches(await handle.stat()))throw Error('Saved installer changed')
        const buffer=Buffer.alloc(256*1024)
        const hash=createHash('sha256')
        let offset=0
        while(offset<asset.size){
            const {bytesRead}=await handle.read(buffer,0,Math.min(buffer.length,asset.size-offset),offset)
            if(!bytesRead)throw Error('Saved installer changed')
            hash.update(buffer.subarray(0,bytesRead));offset+=bytesRead
        }
        if(hash.digest('hex')!==asset.sha256||!matches(await handle.stat())||!matches(await lstat(file)))throw Error('Saved installer changed')
        return file
    }finally{await handle.close()}
}

// Keep long-running downloads out of the one-minute renderer IPC timeout.
// All paths and release metadata are obtained by main-process callbacks.
export class UpdateDownloadTask{
    private state:UpdateDownloadStatus={phase:'idle',received:0,total:0}
    private controller?:AbortController
    private saved?:string
    private savedAsset?:ForkInstaller
    private verification?:Promise<string>
    status(){return {...this.state}}
    get readyPath(){return this.state.phase==='ready'?this.saved:undefined}
    start(getAsset:()=>Promise<ForkInstaller>,chooseDirectory:()=>Promise<string|null>,download=downloadVerifiedInstaller){
        if(this.controller||this.verification)return this.status()
        const controller=new AbortController()
        this.controller=controller;this.saved=undefined;this.savedAsset=undefined
        this.state={phase:'choosing',received:0,total:0}
        void (async()=>{
            try{
                const asset=await getAsset()
                controller.signal.throwIfAborted()
                const directory=await chooseDirectory()
                if(!directory||controller.signal.aborted){this.state.phase='cancelled';return}
                this.state={phase:'downloading',received:0,total:asset.size,name:asset.name}
                const file=await download(asset,directory,controller.signal,received=>{this.state.received=received})
                this.saved=file;this.savedAsset={...asset};this.state={phase:'ready',received:asset.size,total:asset.size,name:asset.name}
            }catch{this.state.phase=controller.signal.aborted?'cancelled':'failed'}
            finally{if(this.controller===controller)this.controller=undefined}
        })()
        return this.status()
    }
    verifyReady(verify=verifySavedInstaller):Promise<string>{
        if(this.verification)return this.verification
        const file=this.readyPath,asset=this.savedAsset
        if(!file||!asset)return Promise.reject(Error('No verified installer'))
        const operation=Promise.resolve().then(()=>verify(file,asset)).catch(error=>{
            this.saved=undefined;this.savedAsset=undefined;this.state.phase='failed'
            throw error
        })
        const result=operation.finally(()=>{if(this.verification===result)this.verification=undefined})
        this.verification=result
        return result
    }
    cancel(){this.controller?.abort();return this.status()}
}
