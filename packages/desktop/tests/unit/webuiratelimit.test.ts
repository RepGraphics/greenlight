import {test} from 'node:test'
import assert from 'node:assert/strict'
import {TokenBucket,createWebUiRateLimiter} from '../../main/helpers/webuiratelimit'

test('WebUI rate limit accepts bounded burst and refills continuously',()=>{
    let now=0
    const bucket=new TokenBucket(3,2,()=>now)
    assert.deepEqual([bucket.consume(),bucket.consume(),bucket.consume()],[0,0,0])
    assert.equal(bucket.consume(),1)
    now=499;assert.equal(bucket.consume(),1)
    now=500;assert.equal(bucket.consume(),0)
    assert.equal(bucket.consume(),1)
    now=60000
    assert.deepEqual([bucket.consume(),bucket.consume(),bucket.consume(),bucket.consume()],[0,0,0,1])
})
test('authentication budget returns a useful Retry-After delay',()=>{
    let now=0
    const bucket=new TokenBucket(1,0.2,()=>now)
    assert.equal(bucket.consume(),0)
    assert.equal(bucket.consume(),5)
    now=2000;assert.equal(bucket.consume(),3)
    now=5000;assert.equal(bucket.consume(),0)
})
test('WebUI middleware prevents downstream authorization and file access after exhaustion',()=>{
    let now=0,passed=0,status=0,message=''
    const headers=new Map<string,string>()
    const response={setHeader:(key:string,value:string)=>headers.set(key,value),status:(code:number)=>{status=code;return {send:(text:string)=>{message=text}}}}
    const rateLimit=createWebUiRateLimiter(new TokenBucket(1,1,()=>now))
    const next=()=>{passed++}
    rateLimit({},response,next)
    rateLimit({},response,next)
    assert.equal(passed,1)
    assert.equal(status,429)
    assert.equal(message,'Too many requests')
    assert.equal(headers.get('Retry-After'),'1')
    assert.equal(headers.get('Cache-Control'),'no-store')
    now=1000;rateLimit({},response,next)
    assert.equal(passed,2)
})
test('invalid budgets are rejected and backward clock changes cannot grant extra tokens',()=>{
    for(const [capacity,rate] of [[0,1],[1,0],[Infinity,1],[1,NaN]])assert.throws(()=>new TokenBucket(capacity,rate))
    let now=1000
    const bucket=new TokenBucket(1,1,()=>now)
    assert.equal(bucket.consume(),0)
    now=0;assert.equal(bucket.consume(),1)
    now=1000;assert.equal(bucket.consume(),1)
    now=2000;assert.equal(bucket.consume(),0)
})
