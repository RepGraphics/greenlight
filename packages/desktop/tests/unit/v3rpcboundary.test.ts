import {test} from 'node:test'
import assert from 'node:assert/strict'
import {rpcBodyLimit,rpcBatchLimit,rpcHeaderFailure,rpcPathAllowed,boundedRpcBody,RpcBodyError} from '../../../pages/src/rpcpolicy'

const headers=(overrides:Record<string,string>={})=>new Headers({'content-type':'application/json',...overrides})
const stream=(...chunks:Uint8Array[])=>new ReadableStream<Uint8Array>({start(controller){for(const chunk of chunks)controller.enqueue(chunk);controller.close()}})
const bytes=(value:string)=>new TextEncoder().encode(value)
test('JSON RPC permits same-origin clients and local tools without fetch metadata',()=>{
    assert.equal(rpcHeaderFailure(headers()),null)
    assert.equal(rpcHeaderFailure(headers({'sec-fetch-site':'same-origin','content-type':'application/json; charset=utf-8'})),null)
    assert.equal(rpcHeaderFailure(headers({'sec-fetch-site':'none','content-length':String(rpcBodyLimit)})),null)
})
test('cross-origin browser metadata and opaque origins are denied',()=>{
    for(const site of ['cross-site','same-site','unknown'])assert.equal(rpcHeaderFailure(headers({'sec-fetch-site':site})),403)
    assert.equal(rpcHeaderFailure(headers({origin:'null'})),403)
})
test('invalid media types, compressed bodies and oversized lengths are rejected',()=>{
    for(const type of ['text/plain','application/x-www-form-urlencoded','multipart/form-data'])assert.equal(rpcHeaderFailure(headers({'content-type':type})),415)
    assert.equal(rpcHeaderFailure(headers({'content-encoding':'gzip'})),415)
    assert.equal(rpcHeaderFailure(headers({'content-length':String(rpcBodyLimit+1)})),413)
    assert.equal(rpcHeaderFailure(headers({'content-length':'invalid'})),400)
})
test('RPC paths bound batch size and reject malformed names',()=>{
    assert.equal(rpcPathAllowed('/trpc/auth.login'),true)
    assert.equal(rpcPathAllowed('/trpc/'+Array(rpcBatchLimit).fill('auth.login').join(',')),true)
    for(const path of ['/trpc','/trpc/','/trpc/a/b','/trpc/a,,b','/trpc/%','/trpc/'+Array(rpcBatchLimit+1).fill('a').join(','),'/trpc/'+'a'.repeat(4096)])assert.equal(rpcPathAllowed(path),false)
})
test('bounded RPC reader preserves exact bytes across chunks',async()=>{
    const body=await boundedRpcBody(stream(bytes('{"0":'),bytes('{"json":null}}')))
    assert.equal(new TextDecoder().decode(body),'{"0":{"json":null}}')
    assert.equal((await boundedRpcBody(stream(new Uint8Array(rpcBodyLimit)))).byteLength,rpcBodyLimit)
})
test('body limit is enforced independently of declared length and missing data is rejected',async()=>{
    await assert.rejects(boundedRpcBody(stream(new Uint8Array(rpcBodyLimit),bytes('x'))),(e:unknown)=>e instanceof RpcBodyError&&e.status===413)
    await assert.rejects(boundedRpcBody(null),(e:unknown)=>e instanceof RpcBodyError&&e.status===400)
    await assert.rejects(boundedRpcBody(stream()),(e:unknown)=>e instanceof RpcBodyError&&e.status===400)
})
