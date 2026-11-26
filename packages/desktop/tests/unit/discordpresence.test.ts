import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import type {Socket} from 'node:net'
import {DiscordPresence,DiscordFrameDecoder,encodeDiscordFrame,discordActivity,discordSocketPaths,validDiscordApplicationId} from '../../main/helpers/discordpresence'
import {isAllowedIpc,isAllowedWebIpc} from '../../main/ipc/policy'
import {portableSettings} from '../../renderer/lib/settingsbackup'

const appId='123456789012345678'
const decode=(frame:Buffer)=>JSON.parse(frame.subarray(8).toString('utf8'))
test('Discord framing supports partial and coalesced packets with bounded payloads',()=>{
    const decoder=new DiscordFrameDecoder(),a=encodeDiscordFrame(0,{v:1,client_id:appId}),b=encodeDiscordFrame(1,{evt:'READY'})
    assert.deepEqual(decoder.read(a.subarray(0,5)),[])
    const frames=decoder.read(Buffer.concat([a.subarray(5),b]))
    assert.deepEqual(frames.map(frame=>[frame.opcode,JSON.parse(frame.body.toString())]),[[0,{v:1,client_id:appId}],[1,{evt:'READY'}]])
    const invalid=Buffer.alloc(8);invalid.writeUInt32LE(70000,4)
    assert.throws(()=>decoder.read(invalid),/Invalid/)
})
test('Discord paths are local IPC only and IDs must be numeric strings',()=>{
    assert.equal(validDiscordApplicationId(appId),true)
    for(const value of [appId+'x',1234,'https://example.com','000000000000000000',null])assert.equal(validDiscordApplicationId(value),false)
    const windows=discordSocketPaths('win32',{})
    assert.equal(windows.length,10)
    assert.equal(windows[0],String.raw`\\?\pipe\discord-ipc-0`)
    assert.ok(discordSocketPaths('linux',{XDG_RUNTIME_DIR:'/run/user/1000'}).every(path=>path.startsWith('/run/user/1000/')))
    assert.deepEqual(discordSocketPaths('freebsd',{}),[])
})
test('Discord POSIX sockets use the target platform rather than the host path separator',()=>{
    const linux=discordSocketPaths('linux',{XDG_RUNTIME_DIR:'/run/user/1000',TMPDIR:'/tmp'})
    assert.deepEqual(linux,[
        ...Array.from({length:10},(_,i)=>'/run/user/1000/discord-ipc-'+i),
        ...Array.from({length:10},(_,i)=>'/run/user/1000/app/com.discordapp.Discord/discord-ipc-'+i)
    ])
    assert.deepEqual(discordSocketPaths('darwin',{TMPDIR:'/var/folders/discord/'}),
        Array.from({length:10},(_,i)=>'/var/folders/discord/discord-ipc-'+i))
    assert.equal(discordSocketPaths('linux',{XDG_RUNTIME_DIR:'relative',TMPDIR:'C:\\Temp',TEMP:'/tmp/discord'})[0],'/tmp/discord/discord-ipc-0')
    assert.equal(discordSocketPaths('darwin',{XDG_RUNTIME_DIR:'C:\\Temp',TMPDIR:'relative'})[0],'/tmp/discord-ipc-0')
    assert.equal(discordSocketPaths('win32',{XDG_RUNTIME_DIR:'/run/user/1000'})[9],String.raw`\\?\pipe\discord-ipc-9`)
})
test('presence contains no account, console or session identifiers and is desktop opt-in only',()=>{
    assert.deepEqual(discordActivity('home',10000),{type:0,details:'Xbox Remote Play',state:'Streaming with Greenlight',timestamps:{start:10},instance:false})
    assert.equal(isAllowedIpc('streaming','setDiscordPresence'),true)
    assert.equal(isAllowedWebIpc('streaming','setDiscordPresence'),false)
    assert.deepEqual(portableSettings({discord_presence_enabled:true,discord_application_id:appId}),{})
})
class MockSocket extends EventEmitter{
    destroyed=false
    sent:Buffer[]=[]
    write(frame:Buffer){this.sent.push(frame);return true}
    end(frame:Buffer){this.sent.push(frame);this.destroy()}
    destroy(){if(!this.destroyed){this.destroyed=true;this.emit('close')}}
}
test('presence waits for READY, sends once, ignores stale owners and clears on release',async()=>{
    const socket=new MockSocket()
    const presence=new DiscordPresence(async()=>socket as unknown as Socket)
    try{
        assert.equal(presence.renew('owner',appId,'home'),true)
        await new Promise<void>(resolve=>setImmediate(resolve))
        assert.equal(socket.sent.length,1)
        assert.deepEqual(decode(socket.sent[0]),{v:1,client_id:appId})
        socket.emit('data',encodeDiscordFrame(1,{cmd:'DISPATCH',evt:'READY'}))
        assert.equal(decode(socket.sent[1]).args.activity.details,'Xbox Remote Play')
        presence.renew('owner',appId,'home')
        presence.release('old')
        assert.equal(socket.sent.length,2)
        presence.release('owner')
        assert.equal(decode(socket.sent[2]).args.activity,null)
    }finally{presence.release()}
})
test('a late Discord connection is destroyed when its stream has already ended',async()=>{
    let resolve!:(socket:Socket)=>void
    const socket=new MockSocket()
    const presence=new DiscordPresence(()=>new Promise<Socket>(done=>{resolve=done}))
    presence.renew('owner',appId,'cloud')
    presence.release('owner')
    resolve(socket as unknown as Socket)
    await new Promise<void>(done=>setImmediate(done))
    assert.equal(socket.destroyed,true)
    assert.deepEqual(socket.sent,[])
})
