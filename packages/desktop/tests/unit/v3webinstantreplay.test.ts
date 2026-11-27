import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WebCaptureSession,type WebCaptureState} from '../../../desktop-v3/renderer/utils/webcapture'
import type {startInstantReplay} from '../../renderer/lib/instantreplay'
import type {startStreamRecording} from '../../renderer/lib/streamrecording'

const video={readyState:2,videoWidth:1280,videoHeight:720} as HTMLVideoElement
const audio={} as HTMLAudioElement
const clip=new Blob(['replay'],{type:'video/webm'})
function fixture(){
    const states:WebCaptureState[]=[]
    const durations:unknown[]=[]
    let saves=0,disposals=0,shots=0,recordings=0
    let ready!:(value:boolean)=>void,fail!:()=>void,finish!:(blob:Blob|null)=>void
    const begin:typeof startInstantReplay=(source,onReady,onError,seconds,sound)=>{
        assert.equal(source,video);assert.equal(sound,audio)
        durations.push(seconds);ready=onReady;fail=onError
        return {dispose:()=>{disposals++},save:()=>{saves++;return new Promise(resolve=>{finish=resolve})}}
    }
    const record:typeof startStreamRecording=()=>{recordings++;return {stop:()=>{},startedAt:0}}
    const session=new WebCaptureSession(state=>states.push(state),async()=>{shots++;return new Blob(['frame'],{type:'image/png'})},record,begin)
    return {session,states,durations,counts:()=>({saves,disposals,shots,recordings}),ready:()=>ready(true),fail:()=>fail(),finish:(blob:Blob|null=clip)=>finish(blob)}
}
test('instant replay is explicitly enabled with bounded duration and excludes other captures',async()=>{
    const f=fixture()
    f.session.startReplay(null,audio,30)
    assert.deepEqual(f.states,[])
    f.session.startReplay(video,audio,60)
    f.session.startReplay(video,audio,15)
    await f.session.takeScreenshot(video)
    f.session.startRecording(video,audio)
    assert.deepEqual(f.durations,[60])
    assert.deepEqual(f.states,[{phase:'replay',replayReady:false}])
    assert.equal(f.counts().shots,0);assert.equal(f.counts().recordings,0)
    f.ready()
    assert.deepEqual(f.states.at(-1),{phase:'replay',replayReady:true})
    f.session.cancelReplay()
    f.session.startReplay(video,audio,999)
    assert.deepEqual(f.durations,[60,30])
    f.session.reset()
})
test('save finalizes one replay and releases the rolling recorder',async()=>{
    const f=fixture()
    f.session.startReplay(video,audio,15)
    const pending=f.session.saveReplay()
    await f.session.saveReplay()
    assert.equal(f.counts().saves,1)
    assert.equal(f.states.at(-1)?.phase,'savingReplay')
    f.finish();await pending
    assert.equal(f.counts().disposals,1)
    assert.equal(f.states.at(-1)?.blob,clip)
    assert.match(f.states.at(-1)?.filename??'',/\.webm$/)
    assert.equal(f.session.discard(),true)
})
test('cancel and reset discard late replay completions',async()=>{
    for(const action of ['cancel','reset']){
        const f=fixture()
        f.session.startReplay(video,audio,30)
        const pending=f.session.saveReplay()
        if(action==='cancel')f.session.cancelReplay()
        else f.session.reset()
        const count=f.states.length
        f.finish();await pending;f.ready();f.fail()
        assert.equal(f.states.length,count)
        assert.equal(f.counts().disposals,1)
    }
})
test('recorder failure releases resources and ignores obsolete callbacks',()=>{
    const f=fixture()
    f.session.startReplay(video,audio,30);f.fail();f.ready();f.fail()
    assert.deepEqual(f.states.at(-1),{phase:'failed'})
    assert.equal(f.counts().disposals,1)
    f.session.discard()
    assert.deepEqual(f.states.at(-1),{phase:'idle'})
})
test('missing or invalid replay output is not exposed for download',async()=>{
    for(const blob of [null,new Blob([],{type:'video/webm'}),new Blob(['bad'],{type:'text/plain'})]){
        const f=fixture()
        f.session.startReplay(video,audio,30)
        const pending=f.session.saveReplay()
        f.finish(blob);await pending
        assert.deepEqual(f.states.at(-1),{phase:'failed'})
        assert.equal(f.counts().disposals,1)
    }
})

test('suspension disposes an unsaved replay but retains an explicitly requested replay save',async()=>{
    const unsaved=fixture();unsaved.session.startReplay(video,audio,30)
    unsaved.session.suspendLiveCapture()
    assert.equal(unsaved.counts().disposals,1)
    assert.deepEqual(unsaved.states.at(-1),{phase:'idle'})
    const saving=fixture();saving.session.startReplay(video,audio,30)
    const pending=saving.session.saveReplay();saving.session.suspendLiveCapture()
    assert.equal(saving.states.at(-1)?.phase,'savingReplay')
    saving.finish();await pending
    assert.equal(saving.states.at(-1)?.blob,clip)
    assert.equal(saving.counts().disposals,1)
})
