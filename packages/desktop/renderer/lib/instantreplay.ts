import { cloneRemoteMedia, recordingMimeType } from './streamrecording'

export const replaySegmentMs=30000
export const replayMaxBytes=32*1024*1024
export function replayDuration(value:unknown):15|30|60{return value===15||value===60?value:30}
export interface ReplaySegment { blob:Blob; startedAt:number; endedAt:number }
export function validReplaySegment(segment:ReplaySegment, now:number, duration=30){
    return segment.blob.size>0&&segment.blob.size<=replayMaxBytes&&segment.blob.type.startsWith('video/webm')&&Number.isFinite(segment.startedAt)&&Number.isFinite(segment.endedAt)&&segment.endedAt>=segment.startedAt&&segment.endedAt<=now&&now-segment.endedAt<=replayDuration(duration)*2000
}
export function startInstantReplay(video:HTMLVideoElement,onReady:(ready:boolean)=>void,onError:()=>void,duration:unknown=30,audio:HTMLAudioElement|null=document.querySelector<HTMLAudioElement>('.gl-experimental-stream #playerContainer audio'),includeAudio=true){
    const seconds=replayDuration(duration)
    const mime=recordingMimeType()
    if(!mime)throw Error('Replay unavailable')
    const {source,tracks,stream}=cloneRemoteMedia(video,audio,includeAudio)
    let disposed=false
    let recorder:MediaRecorder|undefined
    let timer:ReturnType<typeof setTimeout>|undefined
    let latest:ReplaySegment|undefined
    let saving:((blob:Blob|null)=>void)|undefined
    let startedAt=0
    let stopping=false
    let saveDeadline:ReturnType<typeof setTimeout>|undefined
    const dispose=()=>{
        if(disposed)return
        disposed=true
        clearTimeout(timer)
        clearTimeout(saveDeadline)
        latest=undefined
        const resolve=saving;saving=undefined;resolve?.(null)
        if(recorder){
            recorder.ondataavailable=null;recorder.onerror=null;recorder.onstop=null
            if(recorder.state!=='inactive'){try{recorder.stop()}catch{}}
            recorder=undefined
        }
        tracks.forEach(track=>track.stop())
    }
    const fail=()=>{if(disposed)return;dispose();onError()}
    const stopCurrent=()=>{
        if(disposed||!recorder||stopping)return
        stopping=true
        clearTimeout(timer)
        saveDeadline=setTimeout(fail,5000)
        try{if(recorder.state!=='inactive')recorder.stop()}catch{fail()}
    }
    const begin=()=>{
        if(disposed)return
        if(source.readyState!=='live'){fail();return}
        const chunks:Blob[]=[]
        let bytes=0
        let overflow=false
        let current:MediaRecorder
        try{current=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000,audioBitsPerSecond:96000})}catch{fail();return}
        recorder=current
        stopping=false
        startedAt=Date.now()
        const segmentStart=startedAt
        current.ondataavailable=event=>{
            if(disposed||recorder!==current||overflow||!event.data.size)return
            if(bytes+event.data.size>replayMaxBytes){overflow=true;chunks.length=0;fail();return}
            bytes+=event.data.size;chunks.push(event.data)
        }
        current.onerror=()=>{if(recorder===current)fail()}
        current.onstop=()=>{
            if(disposed||recorder!==current||overflow)return
            clearTimeout(timer)
            current.ondataavailable=null;current.onerror=null;current.onstop=null
            const segment={blob:new Blob(chunks,{type:mime}),startedAt:segmentStart,endedAt:Date.now()}
            chunks.length=0
            if(validReplaySegment(segment,Date.now(),seconds))latest=segment
            clearTimeout(saveDeadline)
            const resolve=saving;saving=undefined
            resolve?.(latest&&validReplaySegment(latest,Date.now(),seconds)?latest.blob:null)
            onReady(Boolean(latest))
            begin()
        }
        try{current.start(1000)}catch{fail();return}
        timer=setTimeout(stopCurrent,seconds*1000)
    }
    begin()
    if(disposed)throw Error('Replay could not start')
    return {
        dispose,
        save:():Promise<Blob|null>=>{
            if(disposed||saving)return Promise.resolve(null)
            // Prefer a recent complete segment when the new segment has only just begun.
            if(!recorder)return Promise.resolve(null)
            if(!stopping&&recorder.state!=='inactive'&&latest&&validReplaySegment(latest,Date.now(),seconds)&&Date.now()-startedAt<3000)return Promise.resolve(latest.blob)
            // MediaRecorder becomes inactive before its final data/stop events.
            // Join an in-flight rollover instead of returning a stale segment.
            return new Promise(resolve=>{
                saving=resolve
                stopCurrent()
            })
        }
    }
}
