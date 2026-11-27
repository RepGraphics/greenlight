import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtemp,readFile,readdir,rm,writeFile,stat,symlink} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {selectForkInstaller,selectForkRelease} from '../../main/helpers/updaterelease'
import {downloadVerifiedInstaller,validInstallerRedirect,UpdateDownloadTask,verifySavedInstaller} from '../../main/helpers/updatedownload'
import {isAllowedIpc,isAllowedWebIpc} from '../../main/ipc/policy'
const bytes=Buffer.from('test installer')
const sha=createHash('sha256').update(bytes).digest('hex')
const item={name:'windows-Greenlight Setup 2.5.0.exe',state:'uploaded',size:bytes.length,digest:'sha256:'+sha,browser_download_url:'https://evil.invalid/file'}
const asset=selectForkInstaller([item],'v2.5.0','win32','x64')!
const request=(async()=>new Response(bytes)) as typeof fetch
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
test('installer selection is platform-specific and requires a unique uploaded digest',()=>{
    assert.equal(asset.sha256,sha);assert.ok(asset.url.startsWith('https://github.com/RepGraphics/greenlight/releases/download/v2.5.0/'))
    assert.equal(selectForkInstaller([item,item],'v2.5.0','win32','x64'),undefined)
    assert.equal(selectForkInstaller([{...item,digest:null}],'v2.5.0','win32','x64'),undefined)
    assert.equal(selectForkInstaller([{...item,name:'windows-../file.exe'}],'v2.5.0','win32','x64'),undefined)
    assert.equal(selectForkInstaller([item],'v2.5.0','win32','arm64'),undefined)
    assert.equal(selectForkInstaller([{...item,name:'linux-greenlight.AppImage'}],'v2.5.0','linux','x64')?.name,'linux-greenlight.AppImage')
    assert.equal(selectForkInstaller([{...item,name:'macos-greenlight.dmg'}],'v2.5.0','darwin','arm64')?.name,'macos-greenlight.dmg')
    assert.equal(selectForkRelease([{tag_name:'v2.5.0',draft:false,assets:[item]}],'2.4.2',false,'win32','x64').release?.installer?.name,item.name)
})
test('redirects remain on the fork and GitHub release asset hosts',()=>{
    assert.equal(validInstallerRedirect('https://release-assets.githubusercontent.com/asset?token=1',asset.url),'https://release-assets.githubusercontent.com/asset?token=1')
    for(const value of ['http://github.com/file','https://evil.invalid/file','https://github.com/other/repo/releases/download/a/b','https://user@release-assets.githubusercontent.com/file','https://release-assets.githubusercontent.com:444/file'])assert.throws(()=>validInstallerRedirect(value,asset.url))
})
test('verified download publishes only matching bytes and never overwrites existing files',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-test-'))
    try{
        const path=await downloadVerifiedInstaller(asset,dir,new AbortController().signal,()=>{},request)
        assert.deepEqual(await readFile(path),bytes)
        assert.deepEqual(await readdir(dir),[asset.name])
        await writeFile(path,'existing')
        await assert.rejects(downloadVerifiedInstaller(asset,dir,new AbortController().signal,()=>{},request))
        assert.equal(await readFile(path,'utf8'),'existing')
        assert.deepEqual(await readdir(dir),[asset.name])
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('checksum mismatch, excessive size and cancellation leave no installer or temporary file',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-test-'))
    try{
        await assert.rejects(downloadVerifiedInstaller({...asset,sha256:'0'.repeat(64)},dir,new AbortController().signal,()=>{},request),/checksum/)
        await assert.rejects(downloadVerifiedInstaller({...asset,size:1},dir,new AbortController().signal,()=>{},request),/size/)
        const controller=new AbortController()
        await assert.rejects(downloadVerifiedInstaller(asset,dir,controller.signal,()=>controller.abort(),request))
        assert.deepEqual(await readdir(dir),[])
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('download task stays single-owner and handles cancellation before choosing a folder',async()=>{
    const task=new UpdateDownloadTask();let finish!:(value:typeof asset)=>void;let chosen=0
    task.start(()=>new Promise(resolve=>{finish=resolve}),async()=>{chosen++;return '/tmp'})
    task.start(async()=>asset,async()=>{chosen++;return '/tmp'})
    task.cancel();finish(asset);await flush()
    assert.equal(chosen,0);assert.equal(task.status().phase,'cancelled')
    assert.equal(task.readyPath,undefined)
    task.start(async()=>asset,async()=>'/tmp',async(_a,_d,_s,progress)=>{progress?.(bytes.length);return '/tmp/verified.exe'})
    await flush();assert.equal(task.status().phase,'ready');assert.equal(task.readyPath,'/tmp/verified.exe')
})
test('installer download and reveal IPC are desktop-only',()=>{
    for(const action of ['startUpdateDownload','getUpdateDownloadStatus','cancelUpdateDownload','revealUpdateDownload']){
        assert.equal(isAllowedIpc('app',action),true);assert.equal(isAllowedWebIpc('app',action),false)
    }
})

test('invalid destination and pre-aborted downloads do not request installer bytes',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-test-'))
    let calls=0
    const fetcher=(async()=>{calls++;return new Response(bytes)}) as typeof fetch
    try{
        await assert.rejects(downloadVerifiedInstaller(asset,join(dir,'missing'),new AbortController().signal,()=>{},fetcher))
        const controller=new AbortController();controller.abort()
        await assert.rejects(downloadVerifiedInstaller(asset,dir,controller.signal,()=>{},fetcher))
        assert.equal(calls,0);assert.deepEqual(await readdir(dir),[])
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('HTTP errors, invalid redirects and mismatched content length cancel bodies and clean temporary files',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-test-'))
    try{
        for(const options of [{status:503},{status:302,headers:{location:'https://evil.invalid/file'}},{status:200,headers:{'content-length':'1'}}]){
            let cancelled=0
            const fetcher=(async()=>new Response(new ReadableStream({cancel(){cancelled++}}),options as ResponseInit)) as typeof fetch
            await assert.rejects(downloadVerifiedInstaller(asset,dir,new AbortController().signal,()=>{},fetcher))
            assert.equal(cancelled,1);assert.deepEqual(await readdir(dir),[])
        }
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('network rejection after destination reservation removes temporary directories',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-test-'))
    try{
        await assert.rejects(downloadVerifiedInstaller(asset,dir,new AbortController().signal,()=>{},(async()=>{throw Error('network')}) as typeof fetch),/network/)
        assert.deepEqual(await readdir(dir),[])
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('verified Linux AppImages are executable by the owner only',{skip:process.platform!=='linux'},async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-test-'))
    try{
        const linuxAsset=selectForkInstaller([{...item,name:'linux-Greenlight.AppImage'}],'v2.5.0','linux','x64')!
        const path=await downloadVerifiedInstaller(linuxAsset,dir,new AbortController().signal,()=>{},request)
        assert.equal((await stat(path)).mode&0o777,0o700)
        assert.deepEqual(await readFile(path),bytes)
        assert.deepEqual(await readdir(dir),[linuxAsset.name])
    }finally{await rm(dir,{recursive:true,force:true})}
})

test('saved installer verification detects same-size tampering and deletion',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-reverify-'))
    try{
        const file=join(dir,asset.name)
        await writeFile(file,bytes)
        assert.equal(await verifySavedInstaller(file,asset),file)
        await writeFile(file,Buffer.alloc(bytes.length,65))
        await assert.rejects(verifySavedInstaller(file,asset),/changed/)
        await rm(file)
        await assert.rejects(verifySavedInstaller(file,asset))
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('saved installer verification rejects invalid names, lengths and non-files',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-reverify-'))
    try{
        const file=join(dir,asset.name)
        await writeFile(file,bytes)
        await assert.rejects(verifySavedInstaller(file,{...asset,name:'other.exe'}),/metadata/)
        await assert.rejects(verifySavedInstaller(file,{...asset,size:asset.size+1}),/changed/)
        await rm(file)
        const {mkdir}=await import('node:fs/promises');await mkdir(file)
        await assert.rejects(verifySavedInstaller(file,asset),/changed/)
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('saved installer verification rejects symbolic links even to matching bytes',{skip:process.platform==='win32'},async()=>{
    const dir=await mkdtemp(join(tmpdir(),'streamcloud-reverify-'))
    try{
        const actual=join(dir,'actual.exe'),file=join(dir,asset.name)
        await writeFile(actual,bytes);await symlink(actual,file)
        await assert.rejects(verifySavedInstaller(file,asset),/changed/)
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('installer handoff shares verification and blocks a new download until it settles',async()=>{
    const task=new UpdateDownloadTask()
    const file=join(tmpdir(),asset.name)
    task.start(async()=>asset,async()=>tmpdir(),async()=>file)
    await flush()
    let complete!:(value:string)=>void,calls=0
    const verifying=task.verifyReady(()=>{calls++;return new Promise(resolve=>{complete=resolve})})
    assert.equal(task.verifyReady(),verifying)
    task.start(async()=>assert.fail('download during verification'),async()=>tmpdir())
    await flush();assert.equal(calls,1);complete(file)
    assert.equal(await verifying,file);assert.equal(task.readyPath,file)
    await assert.rejects(task.verifyReady(async()=>{throw Error('changed')}),/changed/)
    assert.equal(task.readyPath,undefined);assert.equal(task.status().phase,'failed')
})
