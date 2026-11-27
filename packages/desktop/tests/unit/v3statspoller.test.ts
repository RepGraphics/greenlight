import {test} from 'node:test'
import assert from 'node:assert/strict'
import {StatsPoller,v3StatsDeadlineMs} from '../../../player/src/client/lib/statspoller'
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function fixture(){
    let now=0,calls=0
    let resolve!:(value:number)=>void,reject!:(error:Error)=>void
    const samples:Array<[number,number]>=[]
    const poller=new StatsPoller(()=>{calls++;return new Promise<number>((ok,fail)=>{resolve=ok;reject=fail})},(value,time)=>samples.push([value,time]),()=>now)
    return {poller,samples,get calls(){return calls},clock:(value:number)=>{now=value},resolve:(value:number)=>resolve(value),reject:()=>reject(Error('native failure'))}
}
test('hung stats requests remain single flight even after the freshness deadline',async()=>{
    const f=fixture();f.poller.tick()
    for(let time=1000;time<60000;time+=1000){f.clock(time);f.poller.tick()}
    assert.equal(f.calls,1);assert.deepEqual(f.samples,[])
    f.resolve(1);await flush();assert.deepEqual(f.samples,[])
    f.poller.tick();assert.equal(f.calls,2)
    f.clock(60001);f.resolve(2);await flush();assert.deepEqual(f.samples,[[2,60001]])
})
test('fresh responses are consumed but exact-deadline responses are discarded',async()=>{
    const f=fixture();f.poller.tick()
    f.clock(v3StatsDeadlineMs-1);f.resolve(1);await flush()
    assert.deepEqual(f.samples,[[1,v3StatsDeadlineMs-1]])
    f.poller.tick();f.clock(2*v3StatsDeadlineMs-1);f.resolve(2);await flush()
    assert.equal(f.samples.length,1)
})
test('native rejection and synchronous exceptions allow a subsequent poll',async()=>{
    const f=fixture();f.poller.tick();f.reject();await flush();f.poller.tick()
    assert.equal(f.calls,2)
    let calls=0,received=0
    const poller=new StatsPoller(()=>{if(++calls===1)throw Error('failure');return Promise.resolve(5)},value=>{received=value},()=>0)
    poller.tick();await flush();poller.tick();await flush()
    assert.equal(received,5)
})
test('disposal suppresses late responses and prevents new requests',async()=>{
    const f=fixture();f.poller.tick();f.poller.dispose();f.resolve(1);await flush()
    f.poller.tick();assert.equal(f.calls,1);assert.deepEqual(f.samples,[])
})
test('invalid or backwards clocks cannot publish fresh stats',async()=>{
    const f=fixture();f.clock(NaN);f.poller.tick();assert.equal(f.calls,0)
    f.clock(1000);f.poller.tick();f.clock(999);f.resolve(1);await flush();assert.deepEqual(f.samples,[])
    f.clock(1000);f.poller.tick();f.clock(Infinity);f.resolve(1);await flush();assert.deepEqual(f.samples,[])
})
