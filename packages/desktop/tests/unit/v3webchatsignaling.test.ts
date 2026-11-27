import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sendChatSDP} from '../../../player/src/server/index'
import {createRemoteSession,type RemoteRpc} from '../../../desktop-v3/renderer/utils/remotesession'
const host='https://uks.core.gssv-play-prodxhome.xboxlive.com'
const config={host,type:'home' as const,id:'console',language:'en-GB',resolution:1080 as const}
const token={token:'test',market:'GB',language:'en-GB'}
const path='/v5/sessions/home/session-123'
const offer={type:'offer' as const,sdp:'v=0\r\n'}
const answer='v=0\r\na=answer\r\n'
test('chat SDP sends desktop-compatible renegotiation and returns only the answer string',async()=>{
    const original=globalThis.fetch
    const calls:string[]=[]
    try{
        globalThis.fetch=async(url,init)=>{
            assert.equal(url,host+path+'/sdp')
            assert.equal(init?.redirect,'error')
            assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer test')
            calls.push(init?.method??'')
            if(init?.method==='POST'){
                assert.deepEqual(JSON.parse(String(init.body)),{messageType:'offer',sdp:offer.sdp,configuration:{isMediaStreamsChatRenegotiation:true}})
                return new Response(null,{status:204})
            }
            return new Response(JSON.stringify({exchangeResponse:JSON.stringify({sdp:answer,type:'answer'})}))
        }
        assert.equal(await sendChatSDP(token,config,path,offer),answer)
        assert.deepEqual(calls,['POST','GET'])
    }finally{globalThis.fetch=original}
})
test('chat SDP rejects foreign origins, paths and invalid offers before network access',async()=>{
    const original=globalThis.fetch
    globalThis.fetch=async()=>assert.fail('unexpected network access')
    try{
        await assert.rejects(sendChatSDP(token,{...config,host:'https://evil.example'},path,offer))
        await assert.rejects(sendChatSDP(token,config,'/v5/sessions/cloud/other',offer))
        for(const invalid of [{type:'answer',sdp:offer.sdp},{type:'offer',sdp:' '},{type:'offer',sdp:'x'.repeat(262145)}] as RTCSessionDescriptionInit[]){
            await assert.rejects(sendChatSDP(token,config,path,invalid),/Invalid chat SDP offer/)
        }
    }finally{globalThis.fetch=original}
})
test('malformed, empty and oversized answers fail without exposing upstream content',async()=>{
    const original=globalThis.fetch
    try{
        for(const exchangeResponse of [undefined,'secret-invalid-json','null','{}','{"sdp":" "}','{"sdp":"secret","type":"offer"}',JSON.stringify({sdp:'x'.repeat(262145)})]){
            globalThis.fetch=async(_url,init)=>init?.method==='POST'?new Response(null,{status:204}):new Response(JSON.stringify({exchangeResponse}))
            await assert.rejects(sendChatSDP(token,config,path,offer),/Invalid chat SDP (response|answer)/)
        }
    }finally{globalThis.fetch=original}
})
function fixture(){
    const calls:string[]=[]
    const rpc:RemoteRpc={
        start:async()=>({sessionPath:path}),
        stop:async()=>{calls.push('stop');return {status:204}},
        status:async()=>({}),sdp:async()=>({}),ice:async()=>({}),connect:async()=>({}),keepalive:async()=>({}),
    }
    return {rpc,calls}
}
test('chat adapter is optional and validates the answer from the owned session',async()=>{
    const f=fixture(),without=createRemoteSession(f.rpc,config,token,{kind:'web',refreshToken:'refresh'})
    const id=await without.start()
    assert.equal(without.player(id).sendChatSDP,undefined)
    await without.stop(id)
    f.rpc.chat=async input=>{assert.equal(input.sessionPath,path);assert.deepEqual(input.offer,offer);return answer}
    const session=createRemoteSession(f.rpc,config,token,{kind:'web',refreshToken:'refresh'}),player=session.player(await session.start())
    assert.equal(await player.sendChatSDP!(offer),answer)
    f.rpc.chat=async()=>null
    await assert.rejects(player.sendChatSDP!(offer),/Invalid chat SDP answer/)
    await session.stop(path)
    await assert.rejects(player.sendChatSDP!(offer),/not active/)
})
test('remote teardown drains pending chat negotiation before DELETE',async()=>{
    const f=fixture()
    let resolve!:(value:string)=>void
    f.rpc.chat=async()=>{f.calls.push('chat');return new Promise<string>(done=>{resolve=done})}
    const session=createRemoteSession(f.rpc,config,token,{kind:'web',refreshToken:'refresh'}),player=session.player(await session.start())
    const chat=player.sendChatSDP!(offer)
    await new Promise<void>(done=>setImmediate(done))
    const stop=session.stop(path)
    await assert.rejects(player.sendChatSDP!(offer),/not active/)
    assert.deepEqual(f.calls,['chat'])
    resolve(answer);await chat;await stop
    assert.deepEqual(f.calls,['chat','stop'])
})
