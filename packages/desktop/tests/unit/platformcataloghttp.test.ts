import {test} from 'node:test'
import assert from 'node:assert/strict'
import Http,{platformResponseLimit} from '../../../platform/src/lib/http'

test('catalog response includes data only, not bearer credentials or upstream headers',async()=>{
    let request:RequestInit|undefined
    const http=new Http(async(_url,options)=>{request=options;return new Response('{"results":[]}',{headers:{'set-cookie':'secret-cookie'}})})
    const result=await http.getRequest('weu.core.gssv-play-prod.xboxlive.com','/v2/titles',{Authorization:'Bearer secret-token'})
    assert.deepEqual(JSON.parse(JSON.stringify(result)),{data:{results:[]}})
    assert.equal(result.body().results.length,0)
    assert.equal(request?.redirect,'error')
    assert.equal(request?.cache,'no-store')
    assert.ok(request?.signal instanceof AbortSignal)
})
test('invalid catalog destinations are rejected before network access',async()=>{
    const http=new Http(async()=>assert.fail('Network access was unexpected'))
    for(const [host,path] of [['evil.example','/v2/titles'],['catalog.gamepass.com','//evil.example'],['catalog.gamepass.com','/\\evil.example'],['catalog.gamepass.com','/v2#secret']])
        await assert.rejects(http.getRequest(host,path,{}),/Invalid catalog destination/)
})
test('catalog failures never expose upstream response bodies or transport details',async()=>{
    const denied=new Http(async()=>new Response('secret-token',{status:403}))
    await assert.rejects(denied.getRequest('catalog.gamepass.com','/v3/products',{}),{message:'Catalog request failed (HTTP 403)'})
    const broken=new Http(async()=>{throw Error('Authorization: Bearer secret')})
    await assert.rejects(broken.getRequest('catalog.gamepass.com','/v3/products',{}),{message:'Catalog request unavailable'})
    const malformed=new Http(async()=>new Response('not-json-secret'))
    await assert.rejects(malformed.getRequest('catalog.gamepass.com','/v3/products',{}),{message:'Catalog request unavailable'})
})
test('catalog response size is bounded by both declared size and received bytes',async()=>{
    const declared=new Http(async()=>new Response('x',{headers:{'content-length':String(platformResponseLimit+1)}}))
    await assert.rejects(declared.getRequest('catalog.gamepass.com','/v3/products',{}),/too large/)
    const streamed=new Http(async()=>new Response(new Uint8Array(platformResponseLimit+1)))
    await assert.rejects(streamed.getRequest('catalog.gamepass.com','/v3/products',{}),/too large/)
})
test('catalog metadata POST serializes the body and uses JSON content type',async()=>{
    const http=new Http(async(_url,options)=>{
        assert.equal(options?.method,'POST')
        assert.equal(new Headers(options?.headers).get('Content-Type'),'application/json')
        assert.equal(options?.body,'{"Products":["ABC"]}')
        return new Response(null,{status:204})
    })
    assert.deepEqual((await http.postRequest('catalog.gamepass.com','/v3/products',{Authorization:'Bearer token'},{Products:['ABC']})).data,{})
})
