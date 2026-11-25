import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ClassicMicrophone,classicChatOffer,negotiateClassicChat} from '../../renderer/lib/classicmicrophone'
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
function fixture(){
    let stops=0
    const track={enabled:true,readyState:'live',onended:null as (()=>void)|null,stop(){stops++;this.readyState='ended'}}
    const stream={getTracks:()=>[track],getAudioTracks:()=>[track]}
    const sender={track:null as typeof track|null,async replaceTrack(value:typeof track|null){this.track=value}}
    const peer={signalingState:'stable',getTransceivers:()=>[{sender,receiver:{track:{kind:'audio'}}}]}
    return {track,stream,sender,peer,get stops(){return stops}}
}
test('microphone stays disabled until negotiation succeeds and stops on disable',async()=>{
    const f=fixture();let complete!:()=>void
    const mic=new ClassicMicrophone(f.peer as any,async()=>f.stream as any,()=>new Promise<void>(resolve=>{complete=resolve}))
    const pending=mic.enable();await flush()
    assert.equal(mic.busy,true);assert.equal(f.track.enabled,false);assert.equal(mic.active,false)
    complete();assert.equal(await pending,true);assert.equal(f.track.enabled,true)
    await mic.disable();assert.equal(mic.active,false);assert.equal(f.sender.track,null);assert.equal(f.stops,1)
})
test('permission resolving after disposal never attaches a microphone',async()=>{
    const f=fixture();let grant!:(stream:any)=>void
    const mic=new ClassicMicrophone(f.peer as any,()=>new Promise(resolve=>{grant=resolve}),async()=>assert.fail('late negotiation'))
    const pending=mic.enable();mic.dispose();grant(f.stream)
    assert.equal(await pending,false);assert.equal(f.sender.track,null);assert.equal(f.stops,1)
})
test('denied permission and failed SDP never leave live capture',async()=>{
    const f=fixture()
    const denied=new ClassicMicrophone(f.peer as any,async()=>{throw Error('denied')},async()=>{})
    await assert.rejects(denied.enable(),/denied/);assert.equal(denied.busy,false)
    const mic=new ClassicMicrophone(f.peer as any,async()=>f.stream as any,async()=>{throw Error('SDP rejected')})
    await assert.rejects(mic.enable(),/SDP rejected/);assert.equal(f.sender.track,null);assert.equal(f.track.enabled,false);assert.equal(mic.active,false)
})
test('disposal disables capture during a delayed SDP exchange',async()=>{
    const f=fixture();let complete!:()=>void
    const mic=new ClassicMicrophone(f.peer as any,async()=>f.stream as any,()=>new Promise<void>(resolve=>{complete=resolve}))
    const pending=mic.enable();await flush();mic.dispose()
    assert.equal(f.track.enabled,false);assert.equal(f.sender.track,null)
    complete();assert.equal(await pending,false);assert.equal(mic.active,false)
})
test('chat offer preserves configured video cap without duplicate bandwidth lines',()=>{
    const source='v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fmtp:111 useinbandfec=1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\nb=AS:123\r\nb=TIAS:1000\r\na=recvonly\r\n'
    const sdp=classicChatOffer(source,8192)
    assert.equal((sdp.match(/b=AS:/g)||[]).length,1);assert.ok(sdp.includes('b=AS:8192\r\na=recvonly'));assert.ok(!sdp.includes('b=TIAS:'));assert.ok(sdp.includes('stereo=1'))
})
test('chat SDP rejection rolls back the pending local offer',async()=>{
    const calls:string[]=[]
    const peer={signalingState:'stable',async createOffer(){return {sdp:'v=0\r\n'}},async setLocalDescription(sdp:{type:string}){calls.push(sdp.type);this.signalingState=sdp.type==='rollback'?'stable':'have-local-offer'},async setRemoteDescription(){assert.fail('invalid answer')}}
    await assert.rejects(negotiateClassicChat(peer as any,0,async()=>null,new AbortController().signal),/Invalid chat answer/)
    assert.deepEqual(calls,['offer','rollback']);assert.equal(peer.signalingState,'stable')
})
