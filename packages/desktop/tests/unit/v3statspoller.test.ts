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

import Stats from '../../../player/src/client/lib/stats'

function statsFixture(){
    const original=Object.getOwnPropertyDescriptor(globalThis,'document')
    Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false}})
    let reports=new Map<string,any>()
    const peer={connectionState:'connected',getStats:async()=>reports}
    const stats=new Stats({_peerConnection:peer} as unknown as ConstructorParameters<typeof Stats>[0])
    return {stats,async sample(...values:Array<{id:string;type:string;[key:string]:unknown}>){
        reports=new Map(values.map(value=>[value.id,value]));stats.loop();await flush()
    },restore(){stats.destroy();if(original)Object.defineProperty(globalThis,'document',original);else Reflect.deleteProperty(globalThis,'document')}}
}
const videoReport=(id:string,timestamp:number,bytesReceived:number)=>({id,type:'inbound-rtp',kind:'video',timestamp,bytesReceived,codecId:'codec',packetsReceived:10,frameWidth:1920,frameHeight:1080,framesPerSecond:60})
test('selected remote candidate is resolved independently of report iteration order',async()=>{
    const f=statsFixture()
    try{
        await f.sample({id:'remote',type:'remote-candidate',address:'192.168.1.20',port:9000},
            {id:'pair',type:'candidate-pair',remoteCandidateId:'remote',currentRoundTripTime:.025,nominated:true,state:'succeeded'},
            {id:'transport',type:'transport',selectedCandidatePairId:'pair'},videoReport('video',100,100))
        assert.equal(f.stats._remoteHost,'192.168.1.20')
        assert.equal(f.stats._remoteIsLocal,true)
        assert.equal(f.stats._rtt,.025)
        await f.sample(videoReport('video',1100,200))
        assert.equal(f.stats._remoteHost,'')
        assert.equal(f.stats._remotePort,0)
        assert.equal(f.stats._rtt,0)
    }finally{f.restore()}
})
test('bitrate baseline resets across video stream replacement and counter regression',async()=>{
    const f=statsFixture()
    try{
        await f.sample(videoReport('first',100,0))
        assert.equal(f.stats._bitrate,0)
        await f.sample(videoReport('first',1100,1000000))
        assert.equal(f.stats._bitrate,8)
        await f.sample(videoReport('second',2100,2000000))
        assert.equal(f.stats._bitrate,0)
        await f.sample(videoReport('second',3100,3000000))
        assert.equal(f.stats._bitrate,8)
        await f.sample(videoReport('second',4100,0))
        assert.equal(f.stats._bitrate,0)
    }finally{f.restore()}
})

test('audio-only statistics cannot refresh stale video readings',async()=>{
    const f=statsFixture()
    try{
        await f.sample(videoReport('video',100,100))
        const videoAt=f.stats.lastVideoStatsAt
        assert.equal(f.stats._videoWidth,1920)
        await f.sample(videoReport('video',100,100),{id:'audio',type:'inbound-rtp',kind:'audio',timestamp:200,bytesReceived:1000})
        assert.equal(f.stats.lastVideoStatsAt,videoAt)
        assert.equal(f.stats._videoWidth,0)
        assert.equal(f.stats._videoFps,0)
        assert.equal(f.stats._bitrate,0)
        await f.sample(videoReport('video',300,300))
        assert.equal(f.stats._videoWidth,1920)
    }finally{f.restore()}
})
