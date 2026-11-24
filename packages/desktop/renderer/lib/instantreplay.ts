import { recordingMimeType } from './streamrecording'

export const replaySegmentMs=30000
export const replayMaxBytes=32*1024*1024
export interface ReplaySegment { blob:Blob; startedAt:number; endedAt:number }
export function validReplaySegment(segment:ReplaySegment, now:number){
    return segment.blob.size>0&&segment.blob.size<=replayMaxBytes&&segment.blob.type.startsWith('video/webm')&&Number.isFinite(segment.startedAt)&&Number.isFinite(segment.endedAt)&&segment.endedAt>=segment.startedAt&&segment.endedAt<=now&&now-segment.endedAt<=replaySegmentMs*2
}
export function startInstantReplay(video:HTMLVideoElement,onReady:(ready:boolean)=>void,onError:()=>void){
    const mime=recordingMimeType()
    if(!mime||!(video.srcObject instanceof MediaStream))throw Error('Replay unavailable')
    const source=video.srcObject.getVideoTracks().find(track=>track.readyState==='live')
    if(!source)throw Error('No live video')
    const audio=document.querySelector<HTMLAudioElement>('.gl-experimental-stream #playerContainer audio')
    const audioTrack=audio?.srcObject instanceof MediaStream?audio.srcObject.getAudioTracks().find(track=>track.readyState==='live'):undefined
    const tracks=[source,...(audioTrack?[audioTrack]:[])].map(track=>track.clone())
    const stream=new MediaStream(tracks)
    let disposed=false
    let recorder:MediaRecorder|undefined
    let timer:ReturnType<typeof setTimeout>|undefined
    let latest:ReplaySegment|undefined
    let saving:((blob:Blob|null)=>void)|undefined
    let startedAt=0
    const dispose=()=>{
        if(disposed)return
        disposed=true
        clearTimeout(timer)
        latest=undefined
        const resolve=saving;saving=undefined;resolve?.(null)
        if(recorder&&recorder.state!=='inactive'){try{recorder.stop()}catch{}}
        tracks.forEach(track=>track.stop())
    }
    const fail=()=>{dispose();onError()}
    const begin=()=>{
        if(disposed)return
        if(source.readyState!=='live'){fail();return}
        const chunks:Blob[]=[]
        let bytes=0
        let overflow=false
        let current:MediaRecorder
        try{current=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000,audioBitsPerSecond:96000})}catch{fail();return}
        recorder=current
        startedAt=Date.now()
        const segmentStart=startedAt
        current.ondataavailable=event=>{
            if(disposed||overflow||!event.data.size)return
            if(bytes+event.data.size>replayMaxBytes){overflow=true;chunks.length=0;fail();return}
            bytes+=event.data.size;chunks.push(event.data)
        }
        current.onerror=fail
        current.onstop=()=>{
            clearTimeout(timer)
            if(disposed||overflow)return
            const segment={blob:new Blob(chunks,{type:mime}),startedAt:segmentStart,endedAt:Date.now()}
            chunks.length=0
            if(validReplaySegment(segment,Date.now()))latest=segment
            const resolve=saving;saving=undefined
            resolve?.(latest&&validReplaySegment(latest,Date.now())?latest.blob:null)
            onReady(Boolean(latest))
            begin()
        }
        try{current.start(1000)}catch{fail();return}
        timer=setTimeout(()=>{try{if(current.state!=='inactive')current.stop()}catch{fail()}},replaySegmentMs)
    }
    begin()
    if(disposed)throw Error('Replay could not start')
    return {
        dispose,
        save:():Promise<Blob|null>=>{
            if(disposed||saving)return Promise.resolve(null)
            // Prefer a recent complete segment when the new segment has only just begun.
            if(latest&&validReplaySegment(latest,Date.now())&&Date.now()-startedAt<3000)return Promise.resolve(latest.blob)
            if(!recorder||recorder.state==='inactive')return Promise.resolve(latest?.blob??null)
            return new Promise(resolve=>{
                saving=resolve
                clearTimeout(timer)
                try{recorder!.stop()}catch{fail()}
            })
        }
    }
}
