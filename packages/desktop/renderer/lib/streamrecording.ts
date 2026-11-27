export const recordingLimitBytes = 128 * 1024 * 1024
export const recordingLimitMs = 5 * 60 * 1000
export const recordingStopThresholdBytes = 120 * 1024 * 1024
export const recordingDurations = [60,180,300,600] as const
export const recordingBitrates = [1500000,3000000,6000000] as const
export function recordingOptions(seconds:unknown,bitrate:unknown){
    return {seconds:recordingDurations.find(value=>value===seconds)??300,videoBitsPerSecond:recordingBitrates.find(value=>value===bitrate)??3000000}
}

export function recordingFilename(date = new Date()) {
    return 'greenlight-clip-' + date.toISOString().replace(/[:.]/g,'-') + '.webm'
}

export function recordingMimeType() {
    if(typeof MediaRecorder==='undefined') return undefined
    return ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type))
}

// Some players expose remote audio on a separate element; others multiplex it
// with video. Clone only these remote tracks and release any partial allocation.
export function cloneRemoteMedia(video: HTMLVideoElement, audio: HTMLAudioElement | null, includeAudio = true) {
    if(typeof MediaStream==='undefined'||!(video.srcObject instanceof MediaStream))throw new Error('Remote media unavailable')
    const source=video.srcObject.getVideoTracks().find(track=>track.readyState==='live')
    if(!source)throw new Error('No live video')
    const audioTrack=includeAudio ? ((audio?.srcObject instanceof MediaStream
        ? audio.srcObject.getAudioTracks().find(track=>track.readyState==='live')
        : undefined) ?? video.srcObject.getAudioTracks().find(track=>track.readyState==='live')) : undefined
    const tracks:MediaStreamTrack[]=[]
    try {
        tracks.push(source.clone())
        if(audioTrack)tracks.push(audioTrack.clone())
        return {source,tracks,stream:new MediaStream(tracks)}
    } catch(error) {
        tracks.forEach(track=>track.stop())
        throw error
    }
}

export function startStreamRecording(video: HTMLVideoElement, onFinished:(blob:Blob|null,error:boolean)=>void, audio:HTMLAudioElement|null=document.querySelector<HTMLAudioElement>('.gl-experimental-stream #playerContainer audio'),preferences?:{seconds?:unknown;videoBitsPerSecond?:unknown;includeAudio?:boolean}) {
    const options=recordingOptions(preferences?.seconds,preferences?.videoBitsPerSecond)
    const mimeType=recordingMimeType()
    if(!mimeType) throw new Error('Recording unavailable')
    const {tracks,stream}=cloneRemoteMedia(video,audio,preferences?.includeAudio)
    let recorder:MediaRecorder
    try {recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:options.videoBitsPerSecond,audioBitsPerSecond:128000})}
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
        if(bytes>=recordingStopThresholdBytes)stop()
    }
    recorder.onerror=()=>{failed=true;stop()}
    recorder.onstop=finish
    try{recorder.start(1000)}catch(error){recorder.ondataavailable=null;recorder.onerror=null;recorder.onstop=null;tracks.forEach(track=>track.stop());throw error}
    timer=setTimeout(stop,options.seconds*1000)
    return {stop,startedAt:Date.now()}
}

export function downloadRecording(blob:Blob){
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a')
    link.href=url;link.download=recordingFilename();document.body.appendChild(link);link.click();link.remove()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
}
