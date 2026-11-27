import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WebCaptureSession,webCaptureMedia,type WebCaptureState} from '../../../desktop-v3/renderer/utils/webcapture'
import type {startStreamRecording} from '../../renderer/lib/streamrecording'
import type {trimClip} from '../../renderer/lib/cliptrim'

const video={readyState:2,videoWidth:1280,videoHeight:720} as HTMLVideoElement
const audio={} as HTMLAudioElement
const png=new Blob(['frame'],{type:'image/png'})
const clip=new Blob(['clip'],{type:'video/webm'})
function fixture(prepareTrim?:typeof trimClip){
    const states:WebCaptureState[]=[]
    let shots=0,starts=0,stops=0
    let completeShot!:(blob:Blob)=>void
    let completeRecording!:(blob:Blob|null,error:boolean)=>void
    const record:typeof startStreamRecording=(source,callback,sound,preferences)=>{
        starts++;assert.equal(source,video);assert.equal(sound,audio)
        assert.deepEqual(preferences,{seconds:60,videoBitsPerSecond:3000000})
        completeRecording=callback
        return {stop:()=>{stops++},startedAt:0}
    }
    const session=new WebCaptureSession(state=>states.push(state),async source=>{
        assert.equal(source,video);shots++
        return await new Promise<Blob>(resolve=>{completeShot=resolve})
    },record,undefined,prepareTrim)
    return {session,states,counts:()=>({shots,starts,stops}),shot:()=>completeShot(png),finish:(blob:Blob|null=clip,error=false)=>completeRecording(blob,error)}
}

test('capture media is scoped to the owned surface and rejects undecoded video',()=>{
    const queries:string[]=[]
    const surface={querySelector(selector:string){queries.push(selector);return selector.endsWith('video')?video:audio}} as unknown as HTMLElement
    assert.deepEqual(webCaptureMedia(surface),{video,audio})
    assert.deepEqual(queries,['#playerContainer video','#playerContainer audio'])
    assert.deepEqual(webCaptureMedia(null),{video:null,audio:null})
    assert.equal(webCaptureMedia({querySelector:()=>({readyState:0,videoWidth:0,videoHeight:0})} as unknown as HTMLElement).video,null)
})
test('screenshots are single flight and become explicitly saveable without auto-download',async()=>{
    const f=fixture()
    const pending=f.session.takeScreenshot(video)
    await f.session.takeScreenshot(video);f.session.startRecording(video,audio)
    assert.deepEqual(f.counts(),{shots:1,starts:0,stops:0})
    f.shot();await pending
    assert.equal(f.states.at(-1)?.phase,'ready');assert.equal(f.states.at(-1)?.blob,png)
    assert.match(f.states.at(-1)?.filename??'',/\.png$/)
})
test('recordings use bounded preferences, preserve explicit stop and expose a clip',()=>{
    const f=fixture()
    f.session.startRecording(video,audio);f.session.startRecording(video,audio)
    assert.equal(f.states.at(-1)?.phase,'recording')
    f.session.stop();f.session.stop()
    assert.deepEqual(f.counts(),{shots:0,starts:1,stops:1})
    assert.equal(f.states.at(-1)?.phase,'stopping')
    f.finish()
    assert.equal(f.states.at(-1)?.blob,clip);assert.match(f.states.at(-1)?.filename??'',/\.webm$/)
})
test('reset discards late screenshot and recording results and stops owned recording',async()=>{
    const f=fixture(),pending=f.session.takeScreenshot(video)
    f.session.reset();f.shot();await pending
    assert.deepEqual(f.states.map(s=>s.phase),['capturing'])
    f.session.startRecording(video,audio);f.session.reset();f.finish()
    assert.deepEqual(f.states.map(s=>s.phase),['capturing','recording'])
    assert.equal(f.counts().stops,1)
})
test('failed captures never expose a partial clip or start without decoded media',()=>{
    const f=fixture()
    f.session.startRecording(null,audio)
    assert.deepEqual(f.states,[])
    f.session.startRecording(video,audio);f.finish(clip,true)
    assert.deepEqual(f.states.at(-1),{phase:'failed'})
})

const range={start:0,end:1}
const trimmed=new Blob(['trimmed'],{type:'video/webm;codecs=vp8,opus'})

test('preparing a web clip trim is single flight and keeps both copies',async()=>{
    let attempts=0
    let finish!:(output:Blob)=>void
    const f=fixture((source,selection,_signal,update)=>{
        attempts++
        assert.equal(source,video)
        assert.deepEqual(selection,range)
        update?.(30)
        return new Promise(resolve=>{finish=resolve})
    })
    f.session.startRecording(video,audio);f.finish()
    const original=f.states.at(-1)
    const pending=f.session.trim(clip,video,range)
    assert.deepEqual(f.states.at(-1),{...original,trim:{phase:'running',progress:30}})
    await f.session.trim(clip,video,range)
    await f.session.takeScreenshot(video)
    f.session.startRecording(video,audio)
    assert.equal(attempts,1)
    assert.deepEqual(f.counts(),{shots:0,starts:1,stops:0})
    finish(trimmed);await pending
    assert.deepEqual(f.states.at(-1),{
        ...original,trim:{phase:'ready',blob:trimmed,filename:original?.filename?.replace(/\.webm$/,'-trimmed.webm')},
    })
})

test('only the current WebM capture can be trimmed and failed output keeps the original',async()=>{
    let attempts=0
    const f=fixture(async()=>{attempts++;return new Blob(['invalid'],{type:'image/png'})})
    const screenshot=f.session.takeScreenshot(video);f.shot();await screenshot
    await f.session.trim(png,video,range)
    f.session.startRecording(video,audio);f.finish()
    const initial=f.states.at(-1)
    await f.session.trim(trimmed,video,range)
    assert.equal(f.states.at(-1),initial)
    await f.session.trim(clip,video,range)
    assert.equal(attempts,1)
    assert.deepEqual(f.states.at(-1),{...initial,trim:{phase:'failed'}})
})

test('cancelling trim keeps the source and ignores stale progress and completion',async()=>{
    let signal!:AbortSignal
    let progress!:(percent:number)=>void
    let finish!:(output:Blob)=>void
    const f=fixture((_source,_range,abort,update)=>{
        signal=abort;progress=update!
        return new Promise(resolve=>{finish=resolve})
    })
    f.session.startRecording(video,audio);f.finish()
    const pending=f.session.trim(clip,video,range)
    f.session.cancelTrim()
    assert.equal(signal.aborted,true)
    assert.equal(f.states.at(-1)?.blob,clip)
    assert.equal(f.states.at(-1)?.trim,undefined)
    const count=f.states.length
    progress(70);finish(trimmed);await pending
    assert.equal(f.states.length,count)
})

test('discarding a capture or ending playback aborts its pending trim',async()=>{
    for(const end of ['discard','reset'] as const){
        let signal!:AbortSignal
        let finish!:(output:Blob)=>void
        const f=fixture((_source,_range,abort)=>{
            signal=abort
            return new Promise(resolve=>{finish=resolve})
        })
        f.session.startRecording(video,audio);f.finish()
        const pending=f.session.trim(clip,video,range)
        f.session[end]()
        assert.equal(signal.aborted,true)
        if(end==='discard')assert.deepEqual(f.states.at(-1),{phase:'idle'})
        const count=f.states.length
        finish(trimmed);await pending
        assert.equal(f.states.length,count)
    }
})

test('suspending live playback finalizes an active recording once and retains its result',()=>{
    const f=fixture()
    f.session.startRecording(video,audio)
    f.session.suspendLiveCapture();f.session.suspendLiveCapture()
    assert.equal(f.counts().stops,1)
    assert.equal(f.states.at(-1)?.phase,'stopping')
    f.finish()
    const ready=f.states.at(-1)
    f.session.suspendLiveCapture()
    assert.equal(f.states.at(-1),ready)
    assert.equal(ready?.blob,clip)
})
test('suspending playback invalidates an unfinished screenshot but preserves a completed one',async()=>{
    const f=fixture()
    const pending=f.session.takeScreenshot(video)
    f.session.suspendLiveCapture()
    f.shot();await pending
    assert.deepEqual(f.states.at(-1),{phase:'failed'})
    const next=f.session.takeScreenshot(video);f.shot();await next
    const ready=f.states.at(-1)
    f.session.suspendLiveCapture()
    assert.equal(f.states.at(-1),ready);assert.equal(ready?.blob,png)
})
test('local clip trimming can finish after the stream is disconnected',async()=>{
    let finish!:(output:Blob)=>void
    const f=fixture(()=>new Promise(resolve=>{finish=resolve}))
    f.session.startRecording(video,audio);f.finish()
    const pending=f.session.trim(clip,video,range)
    f.session.suspendLiveCapture()
    finish(trimmed);await pending
    assert.equal(f.states.at(-1)?.blob,clip)
    assert.equal(f.states.at(-1)?.trim?.phase,'ready')
})
