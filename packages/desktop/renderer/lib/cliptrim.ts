import {recordingLimitBytes,recordingMimeType} from './streamrecording'

export const trimMaxSeconds=600
export function trimRange(start:unknown,end:unknown,duration:unknown){
    const maximum=typeof duration==='number'&&Number.isFinite(duration)&&duration>0?Math.min(duration,trimMaxSeconds):trimMaxSeconds
    if(typeof start!=='number'||typeof end!=='number'||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>maximum||end-start<.5)return null
    return {start,end}
}
type Range={start:number;end:number}
type CapturableVideo=HTMLVideoElement&{captureStream?:()=>MediaStream;mozCaptureStream?:()=>MediaStream}
export function supportsClipTrim(video:CapturableVideo){
    return Boolean((video.captureStream||video.mozCaptureStream)&&recordingMimeType())
}
// Seek before starting the recorder. Bound both the seek and recording phases,
// never reuse the original file, and release every capture track on all exits.
function seek(video:HTMLVideoElement,time:number,signal:AbortSignal){
    return new Promise<void>((resolve,reject)=>{
        if(signal.aborted){reject(Error('Trim cancelled'));return}
        if(!video.seeking&&Math.abs(video.currentTime-time)<.001){resolve();return}
        const finish=(error?:Error)=>{
            clearTimeout(timer)
            video.removeEventListener('seeked',done);video.removeEventListener('error',fail)
            signal.removeEventListener('abort',abort)
            if(error)reject(error);else resolve()
        }
        const done=()=>Math.abs(video.currentTime-time)>.25?finish(Error('Clip seek unavailable')):finish()
        const fail=()=>finish(Error('Clip seek failed'))
        const abort=()=>finish(Error('Trim cancelled'))
        const timer=setTimeout(fail,10000)
        video.addEventListener('seeked',done);video.addEventListener('error',fail)
        signal.addEventListener('abort',abort,{once:true})
        try{video.currentTime=time}catch{fail()}
    })
}
export async function trimClip(video:CapturableVideo,range:Range,signal:AbortSignal,onProgress:(percent:number)=>void=()=>{}){
    const valid=trimRange(range.start,range.end,video.duration),mime=recordingMimeType()
    if(!valid||!mime||!(video.captureStream||video.mozCaptureStream))throw Error('Unsupported clip or range')
    video.pause()
    await seek(video,valid.start,signal)
    if(signal.aborted)throw Error('Trim cancelled')
    const stream=(video.captureStream||video.mozCaptureStream)!.call(video)
    const release=()=>stream.getTracks().forEach(track=>track.stop())
    let recorder:MediaRecorder
    try{
        if(!stream.getVideoTracks().length)throw Error('No captured video')
        recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000,audioBitsPerSecond:128000})
    }catch(error){release();throw error}
    const speed=video.playbackRate
    video.playbackRate=1
    return new Promise<Blob>((resolve,reject)=>{
        let finished=false,stopping=false,bytes=0
        const chunks:Blob[]=[]
        let interval:ReturnType<typeof setInterval>|undefined,deadline:ReturnType<typeof setTimeout>|undefined
        const cleanup=()=>{
            clearInterval(interval);clearTimeout(deadline)
            signal.removeEventListener('abort',abort)
            video.removeEventListener('ended',ended);video.removeEventListener('error',fail)
            recorder.ondataavailable=null;recorder.onstop=null;recorder.onerror=null
            video.pause();video.playbackRate=speed
            if(recorder.state!=='inactive'){try{recorder.stop()}catch{/* release anyway */}}
            release()
        }
        const finish=(error?:Error)=>{
            if(finished)return
            finished=true;cleanup()
            const result=!error&&bytes?new Blob(chunks,{type:mime}):null
            chunks.length=0
            if(result)resolve(result);else reject(error||Error('Empty trimmed clip'))
        }
        const fail=()=>finish(Error('Clip trim failed'))
        const abort=()=>finish(Error('Trim cancelled'))
        const stop=()=>{
            if(stopping||finished)return
            stopping=true;video.pause();clearInterval(interval);clearTimeout(deadline)
            deadline=setTimeout(fail,5000)
            try{if(recorder.state==='inactive')fail();else recorder.stop()}catch{fail()}
        }
        const tick=()=>{
            if(finished||stopping)return
            const elapsed=video.currentTime-valid.start
            onProgress(Math.max(0,Math.min(100,Math.floor(elapsed/(valid.end-valid.start)*100))))
            if(video.currentTime>=valid.end)stop()
        }
        const ended=()=>video.currentTime>=valid.end-.1?stop():fail()
        recorder.ondataavailable=event=>{
            if(finished||!event.data.size)return
            if(bytes+event.data.size>recordingLimitBytes){fail();return}
            bytes+=event.data.size;chunks.push(event.data)
        }
        recorder.onerror=fail
        recorder.onstop=()=>stopping?finish():fail()
        signal.addEventListener('abort',abort,{once:true})
        video.addEventListener('ended',ended);video.addEventListener('error',fail)
        if(signal.aborted){abort();return}
        try{
            recorder.start(250)
            interval=setInterval(tick,50)
            deadline=setTimeout(fail,(valid.end-valid.start)*1000+15000)
            void video.play().catch(fail)
        }catch{fail()}
    })
}
