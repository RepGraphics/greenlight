import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile,symlink,rm,readdir} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {exportCaptureFile,validateCaptureExport} from '../../main/helpers/captureexport'
import {isAllowedIpc,isAllowedWebIpc} from '../../main/ipc/policy'

const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3])
const capture={name:'game.png',kind:'screenshot',bytes:png}
test('capture export rejects paths, device names, incorrect signatures and mismatched extensions',()=>{
    for(const name of ['../game.png','a/b.png','a\\b.png','CON.png','test..png','x.webm','x.png.exe',' .png'])assert.throws(()=>validateCaptureExport({...capture,name}))
    for(const bytes of [null,new Uint8Array([1,2]),'not bytes'])assert.throws(()=>validateCaptureExport({...capture,bytes}))
    assert.equal(validateCaptureExport(capture).name,'game.png')
    assert.equal(validateCaptureExport({name:'clip.webm',kind:'clip',bytes:new Uint8Array([26,69,223,163,1])}).kind,'clip')
})
test('capture exports use exclusive filenames and preserve existing files',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'greenlight-capture-'))
    try{
        await writeFile(join(dir,'game.png'),'existing')
        const [a,b]=await Promise.all([exportCaptureFile(dir,capture),exportCaptureFile(dir,capture)])
        assert.deepEqual([a,b].sort(),['game (1).png','game (2).png'])
        assert.equal(await readFile(join(dir,'game.png'),'utf8'),'existing')
        assert.deepEqual(await readFile(join(dir,a)),Buffer.from(png))
        assert.deepEqual(await readFile(join(dir,b)),Buffer.from(png))
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('capture exports cannot follow an existing filename symlink',async(t)=>{
    if(process.platform==='win32'){t.skip('symlink privileges vary on Windows');return}
    const dir=await mkdtemp(join(tmpdir(),'greenlight-capture-'))
    try{
        await writeFile(join(dir,'target'),'untouched')
        await symlink(join(dir,'target'),join(dir,'game.png'))
        assert.equal(await exportCaptureFile(dir,capture),'game (1).png')
        assert.equal(await readFile(join(dir,'target'),'utf8'),'untouched')
        await assert.rejects(exportCaptureFile(dir,{...capture,name:'../outside.png'}))
        assert.equal((await readdir(dir)).length,3)
    }finally{await rm(dir,{recursive:true,force:true})}
})
test('capture folder access and export are desktop-only IPC operations',()=>{
    for(const action of ['getCaptureDirectory','chooseCaptureDirectory','clearCaptureDirectory','exportCapture']){
        assert.equal(isAllowedIpc('app',action),true)
        assert.equal(isAllowedWebIpc('app',action),false)
    }
})
