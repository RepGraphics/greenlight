import {test} from 'node:test'
import assert from 'node:assert/strict'
import {streamOrigin,sessionEndpoint,playPath} from '../../../player/src/server/requestpolicy'
import {startStream,getStreamStatus,sendMsalToken,stopStream} from '../../../player/src/server/index'

const config={host:'https://uks.core.gssv-play-prodxhome.xboxlive.com',type:'home' as const,id:'console',language:'en-GB',resolution:1080 as const}
const token={token:'test-token',market:'GB',language:'en-GB'}
const path='v5/sessions/home/session-123'
test('Xbox streaming destinations accept production regional hosts only',()=>{
    for(const value of ['https://uks.core.gssv-play-prodxhome.xboxlive.com','https://weu.core.gssv-play-prod.xboxlive.com/','https://xhome.gssv-play-prod.xboxlive.com','https://eus.gssv-play-prodxhome.xboxlive.com'])assert.ok(streamOrigin(value).startsWith('https://'))
    for(const value of ['http://uks.core.gssv-play-prodxhome.xboxlive.com','https://127.0.0.1','https://example.com','https://evil.gssv-play-prod.xboxlive.com.evil.example','https://uks.core.gssv-play-prodxhome.xboxlive.com:443','https://user@uks.core.gssv-play-prodxhome.xboxlive.com','https://uks.core.gssv-play-prodxhome.xboxlive.com/foo','https://uks.core.gssv-play-prodxhome.xboxlive.com?x=1','https://uks.core.gssv-play-prodxhome.xboxlive.com#fragment','https://uks.core.gssv-play-prodxhome.xboxlive.com.'])assert.throws(()=>streamOrigin(value))
})
test('session path validation prevents path traversal and cross-type requests',()=>{
    assert.equal(playPath('home'),'/v5/sessions/home/play')
    assert.equal(sessionEndpoint('home',path,'sdp'),'/'+path+'/sdp')
    assert.equal(sessionEndpoint('home','/'+path),'/'+path)
    for(const value of ['v5/sessions/cloud/id','v5/sessions/home/../active','v5/sessions/home/a%2fb','v5/sessions/home/a?x=1','v5/sessions/home/a#x','v5/sessions/home/play','v5/sessions/home/active','//'+path,'https://example.com/'+path,path+'/state'])assert.throws(()=>sessionEndpoint('home',value))
})
test('invalid destinations and paths are rejected before network or refresh-token exchange',async()=>{
    const original=globalThis.fetch
    globalThis.fetch=async()=>assert.fail('No network request expected')
    try{
        await assert.rejects(startStream(token,{...config,host:'https://example.com'}))
        await assert.rejects(getStreamStatus(token,config,'v5/sessions/cloud/id'))
        await assert.rejects(sendMsalToken(token,{...config,host:'https://example.com'},path,'refresh'))
        await assert.rejects(sendMsalToken(token,config,'../invalid','refresh'))
        await assert.rejects(stopStream(token,config,'../invalid'))
    }finally{globalThis.fetch=original}
})
test('stop acknowledges success or absence, rejects failure, and forbids redirects',async()=>{
    const original=globalThis.fetch
    let status=204
    globalThis.fetch=async(input,init)=>{
        assert.equal(input,config.host+'/'+path)
        assert.equal(init?.method,'DELETE')
        assert.equal(init?.redirect,'error')
        assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer test-token')
        return new Response(null,{status})
    }
    try{
        for(const value of [204,404,410]){status=value;assert.deepEqual(await stopStream(token,config,path),{status:value})}
        status=503;await assert.rejects(stopStream(token,config,path),error=>(error as any).error.status===503)
    }finally{globalThis.fetch=original}
})
test('stream status uses the canonical endpoint and excludes response data on errors',async()=>{
    const original=globalThis.fetch
    globalThis.fetch=async(input,init)=>{
        assert.equal(input,config.host+'/'+path+'/state')
        assert.equal(init?.redirect,'error')
        return new Response('sensitive data',{status:403})
    }
    try{await assert.rejects(getStreamStatus(token,config,'/'+path),error=>{assert.deepEqual(error,{error:{status:403}});return true})}
    finally{globalThis.fetch=original}
})
