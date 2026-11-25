import {test} from 'node:test'
import assert from 'node:assert/strict'
import IpcConsoles from '../../main/ipc/consoles'
import {isAllowedIpc,isAllowedWebIpc} from '../../main/ipc/policy'
function fixture(){
    const calls:string[]=[]
    let active=false
    const provider={
        getConsolesList:async()=>({data:{result:[{id:'owned',remoteManagementEnabled:true},{id:'disabled',remoteManagementEnabled:false}]}}),
        powerOn:async(id:string)=>{calls.push('on:'+id)},
        powerOff:async(id:string)=>{calls.push('off:'+id)}
    }
    const application={_webApi:{providers:{smartglass:provider}},_authentication:{_isAuthenticated:true},_ipc:{_channels:{streaming:{hasHomeStream:()=>active}}}}
    return {channel:new IpcConsoles(application as any),application,provider,calls,setActive(value:boolean){active=value}}
}
test('power commands are allowlisted only for desktop IPC',()=>{
    assert.equal(isAllowedIpc('consoles','power'),true)
    assert.equal(isAllowedWebIpc('consoles','power'),false)
})
test('power commands validate ownership, remote management and command type',async()=>{
    const {channel,calls,application}=fixture()
    await assert.rejects(channel.power({consoleId:'unknown',action:'off'}),/remote management/)
    await assert.rejects(channel.power({consoleId:'disabled',action:'on'}),/remote management/)
    await assert.rejects(channel.power({consoleId:'owned',action:'reboot'} as any),/Invalid/)
    application._authentication._isAuthenticated=false
    await assert.rejects(channel.power({consoleId:'owned',action:'on'}),/Sign in/)
    assert.deepEqual(calls,[])
})
test('power commands protect active streams and do not leak API responses',async()=>{
    const {channel,calls,setActive}=fixture()
    setActive(true)
    await assert.rejects(channel.power({consoleId:'owned',action:'off'}),/active stream/)
    setActive(false)
    assert.deepEqual(await channel.power({consoleId:'owned',action:'on'}),{accepted:true})
    assert.deepEqual(await channel.power({consoleId:'owned',action:'off'}),{accepted:true})
    assert.deepEqual(calls,['on:owned','off:owned'])
})
test('overlapping power commands are rejected and release their lock after failure',async()=>{
    const {channel,provider}=fixture()
    let reject!:(error:Error)=>void
    provider.powerOn=()=>new Promise<void>((_,fail)=>{reject=fail})
    const pending=channel.power({consoleId:'owned',action:'on'})
    const failure=assert.rejects(pending,/did not accept/)
    assert.equal(channel.isPowerPending('owned'),true)
    await assert.rejects(channel.power({consoleId:'owned',action:'off'}),/pending/)
    await new Promise<void>(resolve=>setImmediate(resolve))
    reject(Error('network error'));await failure
    assert.equal(channel.isPowerPending('owned'),false)
    assert.deepEqual(await channel.power({consoleId:'owned',action:'off'}),{accepted:true})
})
test('console refresh requests coalesce and invalidate on provider change',async()=>{
    const {channel,provider,application}=fixture()
    let calls=0
    const result=await provider.getConsolesList()
    provider.getConsolesList=async()=>{calls++;return result}
    await Promise.all([channel.get({force:true}),channel.get({force:true})])
    await channel.get({force:true})
    assert.equal(calls,1)
    application._webApi.providers.smartglass={...provider}
    await channel.get()
    assert.equal(calls,2)
})
