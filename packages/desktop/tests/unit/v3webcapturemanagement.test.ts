import {test} from 'node:test'
import assert from 'node:assert/strict'
import {webRecordingPreferences,webRecordingDurations,webRecordingBitrates,WebCaptureSession,type WebCaptureState} from '../../../desktop-v3/renderer/utils/webcapture'
import type {startStreamRecording} from '../../renderer/lib/streamrecording'
const video={readyState:2,videoWidth:1280,videoHeight:720} as HTMLVideoElement
const clip=new Blob(['clip'],{type:'video/webm'})
const png=new Blob(['frame'],{type:'image/png'})
test('web recording preferences accept only supported duration and quality combinations',()=>{
    for(const seconds of webRecordingDurations)for(const videoBitsPerSecond of webRecordingBitrates){
        assert.deepEqual(webRecordingPreferences(seconds,videoBitsPerSecond),{seconds,videoBitsPerSecond})
    }
})
test('invalid recording preferences fall back independently to safe defaults',()=>{
    for(const value of [undefined,null,NaN,Infinity,-1,600,'180',{}]){
        assert.deepEqual(webRecordingPreferences(value,value),{seconds:60,videoBitsPerSecond:3000000})
    }
    assert.deepEqual(webRecordingPreferences(300,NaN),{seconds:300,videoBitsPerSecond:3000000})
})
test('capture session passes validated recording preferences to the shared bounded recorder',()=>{
    let seen:unknown
    const record:typeof startStreamRecording=(_video,_callback,_audio,preferences)=>{
        seen=preferences
        return {stop:()=>{},startedAt:0}
    }
    const session=new WebCaptureSession(()=>{},async()=>png,record)
    session.startRecording(video,null,{seconds:180,videoBitsPerSecond:1500000})
    assert.deepEqual(seen,{seconds:180,videoBitsPerSecond:1500000})
    session.reset()
    session.startRecording(video,null,{seconds:600,videoBitsPerSecond:99999999})
    assert.deepEqual(seen,{seconds:60,videoBitsPerSecond:3000000})
    session.reset()
})
test('discard removes a ready screenshot and permits a new capture',async()=>{
    const states:WebCaptureState[]=[]
    const session=new WebCaptureSession(state=>states.push(state),async()=>png)
    assert.equal(session.discard(),false)
    await session.takeScreenshot(video)
    assert.equal(states.at(-1)?.blob,png)
    assert.equal(session.discard(),true)
    assert.deepEqual(states.at(-1),{phase:'idle'})
    await session.takeScreenshot(video)
    assert.equal(states.at(-1)?.blob,png)
})
test('discard does not interrupt active recording and clears ready or failed clips',()=>{
    const states:WebCaptureState[]=[]
    let finish!:(blob:Blob|null,error:boolean)=>void
    const record:typeof startStreamRecording=(_video,callback)=>{finish=callback;return {stop:()=>{},startedAt:0}}
    const session=new WebCaptureSession(state=>states.push(state),async()=>png,record)
    session.startRecording(video,null)
    assert.equal(session.discard(),false)
    session.stop()
    assert.equal(session.discard(),false)
    finish(clip,false)
    assert.equal(session.discard(),true)
    assert.deepEqual(states.at(-1),{phase:'idle'})
    session.startRecording(video,null)
    finish(null,true)
    assert.equal(session.discard(),true)
    assert.deepEqual(states.at(-1),{phase:'idle'})
})
