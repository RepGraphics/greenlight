import {test} from 'node:test'
import assert from 'node:assert/strict'
import {AwakeLeaseQueue} from '../../renderer/lib/awakeleasequeue'

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function fixture(){
    let id=0
    const timers=new Map<number,()=>void>()
    const queue=new AwakeLeaseQueue((callback,delay)=>{
        assert.equal(delay,15000)
        timers.set(++id,callback)
        return id as unknown as ReturnType<typeof setInterval>
    },timer=>{timers.delete(timer as unknown as number)})
    return {queue,timers,tick(){for(const callback of timers.values())callback()}}
}
test('same-session replacement waits for prior renewal and release before enabling',async()=>{
    const {queue,timers}=fixture()
    const calls:string[]=[]
    let release:()=>void=()=>{}
    const first=queue.start('session',enabled=>{
        calls.push('old:'+enabled)
        return enabled?new Promise<void>(resolve=>{release=resolve}):Promise.resolve()
    })
    await flush()
    first()
    const second=queue.start('session',async enabled=>{calls.push('new:'+enabled)})
    try{
        await flush()
        assert.deepEqual(calls,['old:true'])
        release()
        await flush()
        assert.deepEqual(calls,['old:true','old:false','new:true'])
        assert.equal(timers.size,1)
    }finally{release();second();await flush()}
    assert.deepEqual(calls,['old:true','old:false','new:true','new:false'])
})
test('renewals are coalesced while pending and failed writes do not poison queue',async()=>{
    const {queue,tick}=fixture()
    const calls:boolean[]=[]
    let reject:(error:Error)=>void=()=>{}
    const stop=queue.start('session',enabled=>{
        calls.push(enabled)
        if(calls.length===1)return new Promise((_,fail)=>{reject=fail})
        return Promise.resolve()
    })
    try{
        await flush();tick();tick();await flush()
        assert.deepEqual(calls,[true])
        reject(Error('offline'));await flush()
        tick();await flush()
        assert.deepEqual(calls,[true,true])
    }finally{stop();stop();await flush()}
    assert.deepEqual(calls,[true,true,false])
})
test('disposing before queued renewal skips enabling and releases once',async()=>{
    const {queue,timers}=fixture()
    const calls:boolean[]=[]
    const stop=queue.start('session',async enabled=>{calls.push(enabled)})
    stop();stop();await flush()
    assert.deepEqual(calls,[false])
    assert.equal(timers.size,0)
})
test('unrelated sessions do not wait on a slow lease write',async()=>{
    const {queue}=fixture()
    let release:()=>void=()=>{}
    const calls:string[]=[]
    const first=queue.start('a',enabled=>{
        calls.push('a:'+enabled)
        return enabled?new Promise<void>(resolve=>{release=resolve}):Promise.resolve()
    })
    const second=queue.start('b',async enabled=>{calls.push('b:'+enabled)})
    try{await flush();assert.deepEqual(calls,['a:true','b:true'])}
    finally{first();second();release();await flush()}
})
