import {test} from 'node:test'
import assert from 'node:assert/strict'
import {PlaybackFrameProgress} from '../../../player/src/client/lib/render/frameprogress'
import VideoComponent from '../../../player/src/client/lib/render/video'

const quality=(totalVideoFrames:number,droppedVideoFrames=0)=>({totalVideoFrames,droppedVideoFrames})
test('fallback tracks presented frame progress, not dropped frames',()=>{
    const tracker=new PlaybackFrameProgress()
    assert.equal(tracker.sample(100,quality(10,2)),100)
    assert.equal(tracker.sample(200,quality(14,6)),100)
    assert.equal(tracker.sample(300,quality(15,6)),300)
    assert.equal(tracker.sample(8000,quality(15,6)),300)
})
test('unknown or invalid counters do not assert a stalled renderer',()=>{
    const tracker=new PlaybackFrameProgress()
    tracker.sample(100,quality(10))
    for(const invalid of [undefined,quality(NaN),quality(1,2),quality(10,-1),quality(Infinity),quality(1.5)]){
        assert.equal(tracker.sample(200,invalid),undefined)
    }
    assert.equal(tracker.sample(500,quality(10)),500)
})
test('counter resets and new surfaces establish a fresh baseline',()=>{
    const tracker=new PlaybackFrameProgress()
    tracker.sample(100,quality(100))
    assert.equal(tracker.sample(500,quality(0)),500)
    tracker.reset()
    assert.equal(tracker.sample(900,quality(0)),900)
})

function fixture(mode:'native'|'fallback'|'unsupported'|'throws'){
    const saved=['document','getComputedStyle'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const)
    const elements:any[]=[],metadata:any[]=[],cancelled:number[]=[]
    const callbacks:Array<(time:number,data:any)=>void>=[]
    const holder={style:{},appendChild:(element:any)=>elements.push(element)}
    Object.defineProperty(globalThis,'getComputedStyle',{configurable:true,value:()=>({position:'static'})})
    Object.defineProperty(globalThis,'document',{configurable:true,value:{
        getElementById:()=>holder,
        createElement:()=>{
            const element:any={style:{},paused:false,srcObject:null,addEventListener(){},removeEventListener(){},play:async()=>{},pause(){this.paused=true},remove(){elements.splice(elements.indexOf(this),1)}}
            if(mode!=='unsupported')element.getVideoPlaybackQuality=()=>quality(10)
            if(mode==='native'||mode==='throws'){
                element.requestVideoFrameCallback=(callback:(time:number,data:any)=>void)=>{
                    if(mode==='throws')throw Error('unavailable')
                    return callbacks.push(callback)
                }
                element.cancelVideoFrameCallback=(id:number)=>cancelled.push(id)
            }
            return element
        }
    }})
    const video=new VideoComponent({getElementId:()=> 'stream',_channels:{input:{queueMetadataFrame:(frame:any)=>metadata.push(frame)}}})
    return {video,elements,metadata,callbacks,cancelled,restore(){video.destroy();for(const [name,d] of saved){if(d)Object.defineProperty(globalThis,name,d);else Reflect.deleteProperty(globalThis,name)}}}
}
test('video playback survives absent or throwing optional frame callback APIs',()=>{
    for(const mode of ['fallback','unsupported','throws'] as const){
        const f=fixture(mode)
        try{
            f.video.create({} as MediaStream)
            assert.equal(f.elements.length,1)
            const first=f.video.getLastFrameAt()
            if(mode==='unsupported')assert.equal(first,undefined)
            else {assert.equal(typeof first,'number');assert.equal(f.video.getLastFrameAt(),first)}
            assert.equal(f.metadata.length,0)
            f.video.destroy();assert.equal(f.elements.length,0)
        }finally{f.restore()}
    }
})
test('native frame callbacks retain metadata and stale callbacks cannot affect a replaced video',()=>{
    const f=fixture('native')
    try{
        f.video.create({} as MediaStream)
        const data={rtpTimestamp:42,receiveTime:5,expectedDisplayTime:10}
        f.callbacks[0](0,data)
        assert.equal(f.metadata.length,1)
        assert.equal(f.metadata[0].serverDataKey,42)
        const stale=f.callbacks[1]
        f.video.create({} as MediaStream)
        assert.deepEqual(f.cancelled,[2]);assert.equal(f.elements.length,1)
        stale(0,data)
        assert.equal(f.metadata.length,1);assert.equal(f.callbacks.length,3)
        f.video.destroy()
        f.callbacks[2](0,data)
        assert.equal(f.metadata.length,1)
        assert.deepEqual(f.cancelled,[2,3])
    }finally{f.restore()}
})
