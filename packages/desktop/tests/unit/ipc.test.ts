import {test} from 'node:test'
import assert from 'node:assert/strict'
import IpcBase from '../../main/ipc/base'
import {isAllowedIpc,isAllowedWebIpc} from '../../main/ipc/policy'
test('IPC blocks unknown channels, prototype methods and desktop-only WebUI commands',()=>{
    for(const channel of ['constructor','__proto__','toString',null])assert.equal(isAllowedIpc(channel,'get'),false)
    for(const action of ['constructor','__proto__','send','onEvent','toString'])assert.equal(isAllowedIpc('streaming',action),false)
    for(const action of ['quit','restart','login','clearData','debug'])assert.equal(isAllowedWebIpc('app',action),false)
    assert.equal(isAllowedWebIpc('settings','getWebUIAccessToken'),false)
    assert.equal(isAllowedWebIpc('streaming','setStreamAwake'),false)
    assert.equal(isAllowedWebIpc('settings','getSettings'),true)
    assert.equal(isAllowedWebIpc('streaming','sendKeepalive'),true)
})
function fixture(){
    const sent:any[]=[]
    class Channel extends IpcBase{
        async get(data:any){return data}
        async startStream(){throw Object.assign(new Error('test failure'),{status:503})}
    }
    const channel=new Channel({_mainWindow:{webContents:{isDestroyed:()=>false,send:(...args:any[])=>sent.push(args)}}} as any)
    return {channel,sent}
}
test('IPC routes responses to the original sender or explicit WebUI callback',async()=>{
    const {channel,sent}=fixture();const sender:any[]=[];const web:any[]=[]
    await channel.onEvent('consoles',{sender:{isDestroyed:()=>false,send:(...args:any[])=>sender.push(args)}},{action:'get',id:1,data:{ok:true}})
    await channel.onEvent('consoles',undefined,{action:'get',id:2,data:{ok:true}},response=>web.push(response))
    assert.equal(sender[0][1].id,1);assert.deepEqual(web[0],{action:'get',id:2,data:{ok:true}});assert.equal(sent.length,0)
})
test('destroyed senders do not leak responses into another window',async()=>{
    const {channel,sent}=fixture()
    await channel.onEvent('consoles',{sender:{isDestroyed:()=>true,send:()=>assert.fail('destroyed')}},{action:'get',id:3,data:{secret:true}})
    assert.equal(sent.length,0)
})
test('IPC invalid IDs are ignored and failures are structured',async()=>{
    const {channel}=fixture();const replies:any[]=[]
    const reply=(value:any)=>replies.push(value)
    await channel.onEvent('consoles',undefined,{action:'get',id:NaN,data:{}},reply)
    await channel.onEvent('consoles',undefined,{action:'constructor',id:4,data:{}},reply)
    await channel.onEvent('streaming',undefined,{action:'startStream',id:5,data:{}},reply)
    assert.equal(replies.length,2);assert.equal(replies[0].error.message,'Unsupported IPC action');assert.equal(replies[1].error.status,503)
})
