import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ClassicStatsPoller,classicStatsRequestDeadlineMs} from '../../renderer/lib/classicstatspoller'

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function fixture(){
    let now=0
    const requests:Array<{resolve:(value:number)=>void;reject:(error:Error)=>void}>=[]
    const samples:Array<{value:number;now:number}>=[],unavailable:number[]=[]
    const poller=new ClassicStatsPoller<number>(
        ()=>new Promise<number>((resolve,reject)=>requests.push({resolve,reject})),
        (value,now)=>samples.push({value,now}),
        now=>unavailable.push(now),
        ()=>now
    )
    return {poller,requests,samples,unavailable,tick(time:number){now=time;poller.tick()},time(time:number){now=time}}
}
test('a hung Classic getStats request emits explicit gaps but never overlaps native requests',async()=>{
    const f=fixture()
    f.tick(0);f.tick(1000);f.tick(2000)
    assert.equal(f.requests.length,1)
    assert.deepEqual(f.unavailable,[])
    for(let n=classicStatsRequestDeadlineMs;n<=20000;n+=1000)f.tick(n)
    assert.equal(f.requests.length,1)
    assert.equal(f.unavailable.length,18)
    assert.equal(f.unavailable[0],3000)
    assert.equal(f.unavailable.at(-1),20000)
    f.requests[0].resolve(9);await flush()
    assert.deepEqual(f.samples,[])
    f.tick(21000);assert.equal(f.requests.length,2)
    f.requests[1].resolve(10);await flush()
    assert.deepEqual(f.samples,[{value:10,now:21000}])
})
test('a late result is discarded even if the interval did not execute at the deadline',async()=>{
    const f=fixture()
    f.tick(0);f.time(classicStatsRequestDeadlineMs)
    f.requests[0].resolve(7);await flush()
    assert.deepEqual(f.samples,[])
    assert.deepEqual(f.unavailable,[3000])
    f.tick(4000);assert.equal(f.requests.length,2)
})
test('ordinary rejection emits one unavailable sample and permits the next poll',async()=>{
    const f=fixture()
    f.tick(0);f.time(250);f.requests[0].reject(Error('stats failed'));await flush()
    assert.deepEqual(f.unavailable,[250])
    f.tick(1000);f.requests[1].resolve(3);await flush()
    assert.deepEqual(f.samples,[{value:3,now:1000}])
})
test('late rejection does not duplicate a gap already emitted by the interval',async()=>{
    const f=fixture()
    f.tick(0);f.tick(3000);f.requests[0].reject(Error('late'));await flush()
    assert.deepEqual(f.unavailable,[3000])
    f.tick(4000);assert.equal(f.requests.length,2)
})
test('disposal suppresses pending completions and future polling',async()=>{
    for(const reject of [false,true]){
        const f=fixture()
        f.tick(0);f.poller.dispose()
        if(reject)f.requests[0].reject(Error('closed'));else f.requests[0].resolve(5)
        await flush();f.tick(20000)
        assert.equal(f.requests.length,1)
        assert.deepEqual(f.samples,[]);assert.deepEqual(f.unavailable,[])
    }
})
