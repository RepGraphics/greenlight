import {test} from 'node:test'
import assert from 'node:assert/strict'
import {MicrophoneLifecycle} from '../../../player/src/client/lib/channel/microphonelifecycle'
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}}
function media(){
    let stops=0
    const track={enabled:true,readyState:'live',onended:null as (()=>void)|null,stop(){stops++;this.readyState='ended'}}
    const stream={getTracks:()=>[track],getAudioTracks:()=>[track]}
    return {track,stream,get stops(){return stops}}
}
function fixture(acquire?:()=>Promise<any>){
    const first=media(),sender={track:null as any,async replaceTrack(track:any){this.track=track}}
    const calls:string[]=[]
    const peer={signalingState:'stable',getTransceivers:()=>[{sender,receiver:{track:{kind:'audio'}}}],async setLocalDescription(value:{type:string}){calls.push(value.type);this.signalingState='stable'}}
    const mic=new MicrophoneLifecycle(peer as any,acquire??(async()=>first.stream as any),async()=>{calls.push('offer');peer.signalingState='have-local-offer';return {type:'offer',sdp:'offer'}},async()=>{calls.push('answer');peer.signalingState='stable'})
    return {first,sender,peer,calls,mic}
}
test('V3 microphone waits for answer and disables the owned track on release',async()=>{
    const f=fixture(),answer=deferred<string>()
    const pending=f.mic.setEnabled(true,()=>answer.promise);await flush()
    assert.equal(f.first.track.enabled,false);assert.equal(f.sender.track,f.first.track)
    answer.resolve('answer');assert.equal(await pending,true);assert.equal(f.first.track.enabled,true)
    const stop=f.mic.setEnabled(false);assert.equal(f.first.track.enabled,false)
    assert.equal(await stop,false);assert.equal(f.sender.track,null);assert.equal(f.first.stops,1)
})
test('late microphone permission is stopped after cancellation without negotiation',async()=>{
    const grant=deferred<any>(),f=fixture(()=>grant.promise)
    const start=f.mic.setEnabled(true,async()=>assert.fail('cancelled negotiation'));await flush()
    const stop=f.mic.setEnabled(false);grant.resolve(f.first.stream)
    assert.equal(await start,false);await stop
    assert.equal(f.first.stops,1);assert.equal(f.sender.track,null);assert.deepEqual(f.calls,[])
})
test('cancelled exchange rolls back before a replacement microphone can negotiate',async()=>{
    const a=media(),b=media(),answer=deferred<string>();let n=0
    const f=fixture(async()=> (++n===1?a:b).stream)
    const first=f.mic.setEnabled(true,()=>answer.promise);await flush()
    const stop=f.mic.setEnabled(false);assert.equal(a.track.enabled,false);assert.equal(a.stops,1)
    const second=f.mic.setEnabled(true,async()=> 'answer')
    await flush();assert.equal(n,1)
    answer.resolve('late');assert.equal(await first,false);await stop;assert.equal(await second,true)
    assert.deepEqual(f.calls,['offer','rollback','offer','answer']);assert.equal(f.sender.track,b.track);assert.equal(b.track.enabled,true)
    await f.mic.setEnabled(false)
})
test('removed microphone clears capture and reports device loss exactly once',async()=>{
    const f=fixture();let ended=0
    assert.equal(await f.mic.setEnabled(true,async()=> 'answer',()=>ended++),true)
    const callback=f.first.track.onended!;callback();callback()
    await flush();assert.equal(ended,1);assert.equal(f.sender.track,null);assert.equal(f.first.stops,1)
})
test('SDP rejection rolls back and disposal suppresses late answers',async()=>{
    const f=fixture()
    await assert.rejects(f.mic.setEnabled(true,async()=>{throw Error('rejected')}),/rejected/)
    assert.deepEqual(f.calls,['offer','rollback']);assert.equal(f.sender.track,null)
    const g=fixture(),answer=deferred<string>()
    const pending=g.mic.setEnabled(true,()=>answer.promise);await flush();g.mic.dispose()
    assert.equal(g.first.track.enabled,false);answer.resolve('late');assert.equal(await pending,false)
    assert.deepEqual(g.calls,['offer','rollback']);assert.equal(g.sender.track,null)
})
