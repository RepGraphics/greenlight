import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultStreamOrigin,returnedSessionPath,createRemoteSession,type RemoteRpc} from '../../../desktop-v3/renderer/utils/remotesession'
import {SessionLifecycle} from '../../renderer/lib/sessionlifecycle'
const host='https://uks.core.gssv-play-prodxhome.xboxlive.com'
const config={id:'console',type:'home' as const,host,language:'en-GB',resolution:720 as const}
const token={token:'test',market:'GB',language:'en-GB'}
const path='/v5/sessions/home/session-1'
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function fixture(){
    const calls:Array<[string,any]>=[]
    let status=204
    const action=(name:string,result:unknown)=>(async(input:any)=>{calls.push([name,input]);return result})
    const rpc:RemoteRpc={
        start:action('start',{sessionPath:path,sessionId:'session-1'}),
        stop:async input=>{calls.push(['stop',input]);return {status}},
        status:action('status',{state:'Provisioned'}),sdp:action('sdp',{exchangeResponse:'{}'}),
        ice:action('ice',{exchangeResponse:'[]'}),connect:action('connect',{}),keepalive:action('keepalive',{})
    }
    return {rpc,calls,setStatus:(value:number)=>{status=value}}
}
test('select only the token-provided default Xbox region and validate returned session paths',()=>{
    assert.equal(defaultStreamOrigin([{isDefault:true,baseUri:host+'/'}]),host)
    assert.throws(()=>defaultStreamOrigin([{isDefault:true,baseUri:'https://example.com'}]))
    assert.throws(()=>defaultStreamOrigin([]))
    assert.throws(()=>defaultStreamOrigin([{isDefault:true,baseUri:host},{isDefault:true,baseUri:host}]))
    assert.equal(returnedSessionPath({sessionPath:path.slice(1)},'home'),path)
    assert.throws(()=>returnedSessionPath({sessionPath:path,sessionId:'wrong'},'home'))
    assert.throws(()=>returnedSessionPath({sessionPath:'/v5/sessions/cloud/a'},'home'))
})
test('web player adapter sends object ICE candidates and routes signaling through the owned session',async()=>{
    const f=fixture(),session=createRemoteSession(f.rpc,config,token,'refresh')
    const id=await session.start(),player=session.player(id)
    assert.equal(player.getSessionId(),'session-1')
    assert.equal(player.getStreamConfig().resolution,720)
    await player.getStreamStatus();await player.sendSDPOffer({type:'offer',sdp:'offer'})
    await player.sendICECandidates([JSON.stringify({candidate:'candidate:1',sdpMid:'0'})])
    await player.sendMSALToken();await player.sendKeepalive();await session.stop(id)
    assert.deepEqual(f.calls.map(item=>item[0]),['start','status','sdp','ice','connect','keepalive','stop'])
    assert.deepEqual(f.calls[3][1].candidates,[{candidate:'candidate:1',sdpMid:'0'}])
    assert.equal(f.calls[4][1].refreshToken,'refresh')
    assert.ok(f.calls.slice(1).every(item=>item[1].sessionPath===path))
    assert.throws(()=>player.sendICECandidates(['invalid']))
})
test('failed stop retains remote session ownership for explicit retry',async()=>{
    const f=fixture(),session=createRemoteSession(f.rpc,config,token,'refresh'),lifecycle=new SessionLifecycle()
    let owned=''
    lifecycle.begin({start:session.start,stop:session.stop,onSession:id=>{owned=id},onError:()=>assert.fail('unexpected error')})
    await flush();assert.equal(owned,path)
    f.setStatus(503);assert.equal(await lifecycle.end(),false)
    f.setStatus(410);assert.equal(await lifecycle.end(),true)
    assert.deepEqual(f.calls.map(item=>item[0]),['start','stop','stop'])
})

test('ending web Remote Play rejects new signaling and drains pending requests before DELETE',async()=>{
    const f=fixture()
    let release!:()=>void
    f.rpc.connect=async input=>{f.calls.push(['connect',input]);await new Promise<void>(resolve=>{release=resolve})}
    const session=createRemoteSession(f.rpc,config,token,'refresh')
    const first=session.start();assert.equal(session.start(),first)
    const id=await first,player=session.player(id)
    const connecting=player.sendMSALToken()
    await flush()
    const stop=session.stop(id);assert.equal(session.stop(id),stop)
    await assert.rejects(player.sendKeepalive(),/not active/)
    await assert.rejects(player.getStreamStatus(),/not active/)
    assert.throws(()=>session.player(id),/not owned/)
    assert.deepEqual(f.calls.map(item=>item[0]),['start','connect'])
    release();await connecting;await stop
    assert.deepEqual(f.calls.map(item=>item[0]),['start','connect','stop'])
    await assert.rejects(session.start(),/closing/)
})
test('failed in-flight signaling does not prevent remote teardown and failed DELETE stays closed to signaling',async()=>{
    const f=fixture()
    let reject!: (reason:Error)=>void
    f.rpc.sdp=async input=>{f.calls.push(['sdp',input]);await new Promise<void>((_resolve,fail)=>{reject=fail})}
    const session=createRemoteSession(f.rpc,config,token,'refresh'),id=await session.start(),player=session.player(id)
    const pending=player.sendSDPOffer({type:'offer',sdp:'offer'})
    const failure=assert.rejects(pending,/network/)
    await flush();f.setStatus(503)
    const stopping=assert.rejects(session.stop(id),/not acknowledged/)
    reject(Error('network'));await failure;await stopping
    await assert.rejects(player.sendKeepalive(),/not active/)
    f.setStatus(410);await session.stop(id)
    assert.deepEqual(f.calls.map(item=>item[0]),['start','sdp','stop','stop'])
})
test('cannot address an unrelated session even with a syntactically valid path',async()=>{
    const f=fixture(),session=createRemoteSession(f.rpc,config,token,'refresh')
    const id=await session.start()
    assert.throws(()=>session.player('/v5/sessions/home/other'),/not owned/)
    await assert.rejects(session.stop('/v5/sessions/home/other'),/not owned/)
    assert.deepEqual(f.calls.map(item=>item[0]),['start'])
    await session.stop(id)
})
