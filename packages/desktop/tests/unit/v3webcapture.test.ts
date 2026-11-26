import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WebCaptureSession,webCaptureMedia,type WebCaptureState} from '../../../desktop-v3/renderer/utils/webcapture'
import type {startStreamRecording} from '../../renderer/lib/streamrecording'

const video={readyState:2,videoWidth:1280,videoHeight:720} as HTMLVideoElement
const audio={} as HTMLAudioElement
const png=new Blob(['frame'],{type:'image/png'})
const clip=new Blob(['clip'],{type:'video/webm'})
function fixture(){
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
    },record)
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
