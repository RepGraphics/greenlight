import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readStreamingResponse,streamingResponseLimit,transferTokenResponseLimit} from '../../../player/src/server/response'
import {getStreamStatus,sendKeepalive,sendMsalToken} from '../../../player/src/server/index'

const config={host:'https://uks.core.gssv-play-prodxhome.xboxlive.com',type:'home' as const,id:'console',language:'en-GB',resolution:1080 as const}
const token={token:'test-token',market:'GB',language:'en-GB'}
const path='v5/sessions/home/session-123'

test('streaming response accepts objects and empty acknowledgements',async()=>{
    assert.deepEqual(await readStreamingResponse(new Response('{"state":"Provisioned"}'),100),{state:'Provisioned'})
    assert.equal(await readStreamingResponse(new Response(null,{status:204}),100),undefined)
    assert.equal(await readStreamingResponse(new Response('  '),100),undefined)
})
test('nonempty malformed JSON, arrays, primitives and invalid UTF-8 are rejected without exposing payloads',async()=>{
    for(const body of ['secret-not-json','null','[]','123','true','"secret"',new Uint8Array([0xc0,0x80])]){
        await assert.rejects(readStreamingResponse(new Response(body),100),{message:'Invalid Xbox response'})
    }
})
test('response size is bounded by both header and streamed bytes and cancels the body',async()=>{
    for(const declared of [true,false]){
        let cancelled=0
        const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(101))},cancel(){cancelled++}})
        const response=new Response(stream,{headers:declared?{'content-length':'101'}:{}})
        await assert.rejects(readStreamingResponse(response,100),{message:'Xbox response too large'})
        assert.equal(cancelled,1)
        assert.equal(response.body?.locked,false)
    }
})
test('streaming RPC preserves empty keepalive acknowledgement and rejects corrupt status',async()=>{
    const original=globalThis.fetch
    try{
        globalThis.fetch=async()=>new Response(null,{status:204})
        assert.deepEqual(await sendKeepalive(token,config,path),{status:204})
        globalThis.fetch=async()=>new Response('unexpected confidential payload')
        await assert.rejects(getStreamStatus(token,config,path),{message:'Invalid Xbox response'})
        globalThis.fetch=async()=>new Response('{}',{headers:{'content-length':String(streamingResponseLimit+1)}})
        await assert.rejects(getStreamStatus(token,config,path),{message:'Xbox response too large'})
    }finally{globalThis.fetch=original}
})
test('invalid or oversized transfer token responses never reach the Xbox connect endpoint',async()=>{
    const original=globalThis.fetch
    try{
        for(const response of [new Response('{"access_token":""}'),new Response('null'),new Response('not-json'),new Response('{}',{headers:{'content-length':String(transferTokenResponseLimit+1)}})]){
            let requests=0
            globalThis.fetch=async(url)=>{requests++;assert.equal(url,'https://login.live.com/oauth20_token.srf');return response}
            await assert.rejects(sendMsalToken(token,config,path,'refresh'))
            assert.equal(requests,1)
        }
    }finally{globalThis.fetch=original}
})
test('valid transfer token exchange sends only the expected token to the validated connect endpoint',async()=>{
    const original=globalThis.fetch
    const urls:string[]=[]
    try{
        globalThis.fetch=async(url,init)=>{
            urls.push(String(url))
            if(urls.length===1)return new Response('{"access_token":"transfer"}')
            assert.deepEqual(JSON.parse(String(init?.body)),{userToken:'transfer'})
            return new Response(null,{status:204})
        }
        assert.deepEqual(await sendMsalToken(token,config,path,'refresh'),{status:204})
        assert.deepEqual(urls,['https://login.live.com/oauth20_token.srf',config.host+'/'+path+'/connect'])
    }finally{globalThis.fetch=original}
})
