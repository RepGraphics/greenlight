import {test} from 'node:test'
import assert from 'node:assert/strict'
import {trimRange,trimClip} from '../../renderer/lib/cliptrim'
test('trim ranges require finite ordered values within the source and duration limit',()=>{
    assert.deepEqual(trimRange(1,5,10),{start:1,end:5})
    assert.deepEqual(trimRange(0,600,Infinity),{start:0,end:600})
    for(const [a,b,d] of [[-1,5,10],[1,1.1,10],[2,1,10],[0,11,10],[0,601,Infinity],[NaN,3,10],[0,Infinity,10],['1',3,10]])assert.equal(trimRange(a,b,d),null)
})
function fixture(){
    const previous=Object.getOwnPropertyDescriptor(globalThis,'MediaRecorder')
    let stopped=0
    const track={stop(){stopped++}}
    class Recorder {
        static isTypeSupported(){return true}
        state='inactive'
        ondataavailable:any;onstop:any;onerror:any
        start(){this.state='recording'}
        stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['clip'])});this.onstop?.()}
    }
    class Video extends EventTarget{
        duration=10;currentTime=0;seeking=false;playbackRate=1.5;paused=true
        captureStream(){return {getTracks:()=>[track],getVideoTracks:()=>[track]}}
        pause(){this.paused=true}
        async play(){this.paused=false}
    }
    Object.defineProperty(globalThis,'MediaRecorder',{configurable:true,value:Recorder})
    const video=new Video()
    return {video,get stopped(){return stopped},restore(){if(previous)Object.defineProperty(globalThis,'MediaRecorder',previous);else Reflect.deleteProperty(globalThis,'MediaRecorder')}}
}
test('clip trimming records a new blob and restores playback and tracks',async()=>{
    const f=fixture(),controller=new AbortController()
    try{
        const pending=trimClip(f.video as any,{start:0,end:1},controller.signal)
        await new Promise<void>(resolve=>setImmediate(resolve))
        f.video.currentTime=1;f.video.dispatchEvent(new Event('ended'))
        const blob=await pending
        assert.equal(await blob.text(),'clip');assert.equal(f.stopped,1)
        assert.equal(f.video.playbackRate,1.5);assert.equal(f.video.paused,true)
    }finally{f.restore()}
})
test('cancelled clip trim rejects and releases capture tracks',async()=>{
    const f=fixture(),controller=new AbortController()
    try{
        const pending=assert.rejects(trimClip(f.video as any,{start:0,end:2},controller.signal),/cancelled/)
        await new Promise<void>(resolve=>setImmediate(resolve))
        controller.abort();await pending
        assert.equal(f.stopped,1);assert.equal(f.video.playbackRate,1.5)
    }finally{f.restore()}
})
test('a clip ending before its selected range rejects instead of saving a partial result',async()=>{
    const f=fixture(),controller=new AbortController()
    try{
        const pending=assert.rejects(trimClip(f.video as any,{start:0,end:3},controller.signal),/failed/)
        await new Promise<void>(resolve=>setImmediate(resolve))
        f.video.currentTime=1;f.video.dispatchEvent(new Event('ended'));await pending
        assert.equal(f.stopped,1)
    }finally{f.restore()}
})
