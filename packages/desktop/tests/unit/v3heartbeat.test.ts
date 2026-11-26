import {test} from 'node:test'
import assert from 'node:assert/strict'
import {StreamHeartbeat,heartbeatTimeoutMs,heartbeatIntervalMs,heartbeatRetryMs} from '../../../player/src/client/lib/heartbeat'

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function fixture(){
    let id=0,failures=0,calls=0
    const timers=new Map<number,{fn:()=>void;delay:number}>()
    const requests:Array<{resolve:()=>void;reject:()=>void}>=[]
    const heartbeat=new StreamHeartbeat(()=>{calls++;return new Promise<void>((resolve,reject)=>requests.push({resolve,reject:()=>reject(Error('network'))}))},()=>{failures++},((fn:()=>void,delay:number)=>{timers.set(++id,{fn,delay});return id}) as any,((id:number)=>timers.delete(id)) as any)
    function fire(delay:number){
        const entry=[...timers.entries()].find(([,value])=>value.delay===delay)
        assert.ok(entry,'expected timer '+delay)
        timers.delete(entry[0]);entry[1].fn()
    }
    return {heartbeat,timers,requests,fire,calls:()=>calls,failures:()=>failures}
}

test('a hung V3 heartbeat fails once without overlapping requests',async()=>{
    const f=fixture();f.heartbeat.start();f.heartbeat.start()
    assert.equal(f.calls(),1)
    f.fire(heartbeatTimeoutMs)
    assert.equal(f.failures(),1);assert.equal(f.timers.size,0)
    f.requests[0].resolve();await flush()
    assert.equal(f.calls(),1);assert.equal(f.timers.size,0)
})

test('successful heartbeats schedule the normal interval after settlement',async()=>{
    const f=fixture();f.heartbeat.start()
    f.requests[0].resolve();await flush()
    assert.deepEqual([...f.timers.values()].map(t=>t.delay),[heartbeatIntervalMs])
    f.fire(heartbeatIntervalMs);assert.equal(f.calls(),2)
    f.heartbeat.dispose();f.requests[1].resolve();await flush()
    assert.equal(f.timers.size,0);assert.equal(f.failures(),0)
})

test('three consecutive heartbeat rejections terminate with bounded retry intervals',async()=>{
    const f=fixture();f.heartbeat.start()
    for(let i=0;i<3;i++){
        f.requests[i].reject();await flush()
        if(i<2)f.fire(heartbeatRetryMs)
    }
    assert.equal(f.calls(),3);assert.equal(f.failures(),1);assert.equal(f.timers.size,0)
})

test('a successful request resets consecutive failures',async()=>{
    const f=fixture();f.heartbeat.start()
    f.requests[0].reject();await flush();f.fire(heartbeatRetryMs)
    f.requests[1].reject();await flush();f.fire(heartbeatRetryMs)
    f.requests[2].resolve();await flush();f.fire(heartbeatIntervalMs)
    f.requests[3].reject();await flush()
    assert.equal(f.failures(),0);assert.deepEqual([...f.timers.values()].map(t=>t.delay),[heartbeatRetryMs])
    f.heartbeat.dispose()
})

test('disposal cancels pending deadlines and ignores late rejections',async()=>{
    const f=fixture();f.heartbeat.start()
    f.heartbeat.dispose();f.heartbeat.start()
    f.requests[0].reject();await flush()
    assert.equal(f.calls(),1);assert.equal(f.failures(),0);assert.equal(f.timers.size,0)
})
