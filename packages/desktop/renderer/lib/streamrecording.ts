export const recordingLimitBytes = 128 * 1024 * 1024
export const recordingLimitMs = 5 * 60 * 1000

export function recordingFilename(date = new Date()) {
    return 'greenlight-clip-' + date.toISOString().replace(/[:.]/g,'-') + '.webm'
}

export function recordingMimeType() {
    if(typeof MediaRecorder==='undefined') return undefined
    return ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))
}

export function startStreamRecording(video: HTMLVideoElement, onFinished:(blob:Blob|null,error:boolean)=>void, audio:HTMLAudioElement|null=document.querySelector<HTMLAudioElement>('.gl-experimental-stream #playerContainer audio')) {
    const mimeType=recordingMimeType()
    if(!mimeType || !(video.srcObject instanceof MediaStream)) throw new Error('Recording unavailable')
    const videoTrack=video.srcObject.getVideoTracks().find(track=>track.readyState==='live')
    if(!videoTrack) throw new Error('No live video')
    const audioTrack=audio?.srcObject instanceof MediaStream ? audio.srcObject.getAudioTracks().find(track=>track.readyState==='live') : undefined
    // Only remote media tracks. Never record local microphone or desktop.
    const tracks=[videoTrack,...(audioTrack?[audioTrack]:[])].map(track=>track.clone())
    let recorder:MediaRecorder
    try {recorder=new MediaRecorder(new MediaStream(tracks),{mimeType,videoBitsPerSecond:3000000,audioBitsPerSecond:128000})}
    catch(error){tracks.forEach(track=>track.stop());throw error}
    const chunks:Blob[]=[]
    let bytes=0
    let failed=false
    let finished=false
    let timer:ReturnType<typeof setTimeout>|undefined
    let deadline:ReturnType<typeof setTimeout>|undefined
    let stopping=false
    let overflow=false
    const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(deadline);recorder.ondataavailable=null;recorder.onerror=null;recorder.onstop=null;tracks.forEach(track=>track.stop());const blob=chunks.length?new Blob(chunks,{type:mimeType}):null;chunks.length=0;onFinished(blob,failed)}
    const stop=()=>{
        if(stopping||finished)return
        stopping=true;clearTimeout(timer)
        deadline=setTimeout(()=>{failed=true;chunks.length=0;finish()},5000)
        try{if(recorder.state!=='inactive')recorder.stop()}catch{failed=true;finish()}
    }
    recorder.ondataavailable=event=>{
        if(finished||overflow||event.data.size===0)return
        if(bytes+event.data.size>recordingLimitBytes){failed=true;overflow=true;chunks.length=0;stop();return}
        chunks.push(event.data);bytes+=event.data.size
        if(bytes>=recordingLimitBytes)stop()
    }
    recorder.onerror=()=>{failed=true;stop()}
    recorder.onstop=finish
    try{recorder.start(1000)}catch(error){tracks.forEach(track=>track.stop());throw error}
    timer=setTimeout(stop,recordingLimitMs)
    return {stop,startedAt:Date.now()}
}

export function downloadRecording(blob:Blob){
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a')
    link.href=url;link.download=recordingFilename();document.body.appendChild(link);link.click();link.remove()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
}
