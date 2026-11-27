import {canCapture,captureScreenshotBlob,screenshotFilename} from '../../../desktop/renderer/lib/streamcapture'
import {startStreamRecording,recordingFilename,recordingLimitBytes} from '../../../desktop/renderer/lib/streamrecording'
import {trimClip,type ClipTrimRange} from '../../../desktop/renderer/lib/cliptrim'

import {startInstantReplay,replayDuration,replayMaxBytes} from '../../../desktop/renderer/lib/instantreplay'

import {webRecordingPreferences} from '../../shared/recordingpreferences'
export {webReplayDurations, webRecordingDurations, webRecordingBitrates, webRecordingPreferences} from '../../shared/recordingpreferences'
export type WebClipTrimState={phase:'running';progress:number}|{phase:'ready';blob:Blob;filename:string}|{phase:'failed'}
export type WebCaptureState={phase:'idle'|'capturing'|'recording'|'stopping'|'replay'|'savingReplay'|'ready'|'failed';blob?:Blob;filename?:string;replayReady?:boolean;trim?:WebClipTrimState}

export function isWebCaptureClip(blob?:Blob):blob is Blob{
    return Boolean(blob&&blob.size>0&&blob.size<=recordingLimitBytes&&blob.type.split(';',1)[0]==='video/webm')
}

export function webCaptureMedia(surface:HTMLElement|null){
    const video=surface?.querySelector<HTMLVideoElement>('#playerContainer video')??null
    const audio=surface?.querySelector<HTMLAudioElement>('#playerContainer audio')??null
    return {video:canCapture(video)?video:null,audio}
}

// Run one capture or trim at a time within the mounted connected player.
// The user downloads completed media explicitly.
export class WebCaptureSession{
    private generation=0
    private state:WebCaptureState={phase:'idle'}
    private recording?:{stop:()=>void}
    private replay?:ReturnType<typeof startInstantReplay>
    private trimController?:AbortController
    constructor(private update:(state:WebCaptureState)=>void,private screenshot=captureScreenshotBlob,private record=startStreamRecording,private beginReplay=startInstantReplay,private prepareTrim=trimClip){}
    private publish(state:WebCaptureState){this.state=state;this.update(state)}
    private available(){return !this.trimController&&['idle','failed'].includes(this.state.phase)}
    async takeScreenshot(video:HTMLVideoElement|null){
        if(!this.available()||!canCapture(video))return
        const generation=++this.generation
        this.publish({phase:'capturing'})
        try{
            const blob=await this.screenshot(video)
            if(generation===this.generation)this.publish(blob.size>0&&blob.size<=recordingLimitBytes&&blob.type==='image/png'?{phase:'ready',blob,filename:screenshotFilename()}:{phase:'failed'})
        }catch{if(generation===this.generation)this.publish({phase:'failed'})}
    }
    startRecording(video:HTMLVideoElement|null,audio:HTMLAudioElement|null,preferences?:{seconds?:unknown;videoBitsPerSecond?:unknown;includeAudio?:boolean}){
        if(!this.available()||!canCapture(video))return
        const generation=++this.generation
        this.publish({phase:'recording'})
        try{
            const recording=this.record(video,(blob,error)=>{
                if(generation!==this.generation)return
                this.recording=undefined
                this.publish(isWebCaptureClip(blob??undefined)&&!error?{phase:'ready',blob:blob!,filename:recordingFilename()}:{phase:'failed'})
            },audio,{
                ...webRecordingPreferences(preferences?.seconds,preferences?.videoBitsPerSecond),
                ...(preferences?.includeAudio===false?{includeAudio:false}:{}),
            })
            if(generation===this.generation&&this.state.phase==='recording')this.recording=recording
            else recording.stop()
        }catch{if(generation===this.generation)this.publish({phase:'failed'})}
    }
    startReplay(video:HTMLVideoElement|null,audio:HTMLAudioElement|null,seconds:unknown,includeAudio=true){
        if(!this.available()||!canCapture(video))return
        const generation=++this.generation
        this.publish({phase:'replay',replayReady:false})
        const fail=()=>{
            if(generation!==this.generation)return
            const replay=this.replay
            this.replay=undefined
            this.generation++
            replay?.dispose()
            this.publish({phase:'failed'})
        }
        try{
            const replay=this.beginReplay(video,ready=>{
                if(generation===this.generation&&this.state.phase==='replay')this.publish({phase:'replay',replayReady:ready})
            },fail,replayDuration(seconds),audio,includeAudio)
            if(generation===this.generation&&this.state.phase==='replay')this.replay=replay
            else replay.dispose()
        }catch{fail()}
    }
    async saveReplay(){
        const replay=this.replay
        if(!replay||this.state.phase!=='replay')return
        const generation=this.generation
        this.publish({phase:'savingReplay'})
        let blob:Blob|null=null
        try{blob=await replay.save()}catch{}
        if(generation!==this.generation)return
        this.generation++
        this.replay=undefined
        replay.dispose()
        this.publish(isWebCaptureClip(blob??undefined)&&blob!.size<=replayMaxBytes?{phase:'ready',blob:blob!,filename:recordingFilename()}:{phase:'failed'})
    }
    cancelReplay(){
        if(this.state.phase!=='replay'&&this.state.phase!=='savingReplay')return
        this.generation++
        const replay=this.replay
        this.replay=undefined
        replay?.dispose()
        this.publish({phase:'idle'})
    }
    stop(){
        if(this.state.phase!=='recording'||!this.recording)return
        this.publish({phase:'stopping'})
        try{this.recording.stop()}catch{
            this.generation++;this.recording=undefined;this.publish({phase:'failed'})
        }
    }
    // Stop live media work when the stream ceases to be connected. Completed
    // captures and local clip edits belong to the current page, not the peer.
    suspendLiveCapture(){
        if(this.state.phase==='recording'){this.stop();return}
        if(this.state.phase==='replay'){this.cancelReplay();return}
        if(this.state.phase==='capturing'){
            this.generation++
            this.publish({phase:'failed'})
        }
        // An explicitly requested recording/replay finalization may finish.
        // Local trim work is independent of the Xbox connection.
    }
    async trim(original:Blob,video:HTMLVideoElement,range:ClipTrimRange){
        const source=this.state
        if(this.trimController||source.phase!=='ready'||source.blob!==original||!isWebCaptureClip(original)||!source.filename)return
        const filename=source.filename.replace(/\.webm$/i,'-trimmed.webm')
        const controller=new AbortController()
        this.trimController=controller
        this.publish({...source,trim:{phase:'running',progress:0}})
        let result:WebClipTrimState={phase:'failed'}
        try{
            const blob=await this.prepareTrim(video,range,controller.signal,progress=>{
                if(this.trimController===controller&&this.state.trim?.phase==='running'&&this.state.trim.progress!==progress){
                    this.publish({...source,trim:{phase:'running',progress}})
                }
            })
            if(isWebCaptureClip(blob))result={phase:'ready',blob,filename}
        }catch{
            // A failure leaves the source available for retry or download.
        }
        if(this.trimController!==controller)return
        this.trimController=undefined
        this.publish({...source,trim:result})
    }
    private abortTrim(){
        const controller=this.trimController
        this.trimController=undefined
        controller?.abort()
    }
    cancelTrim(){
        if(!this.trimController)return
        this.abortTrim()
        this.publish({...this.state,trim:undefined})
    }
    discard(){
        if(this.state.phase!=='ready'&&this.state.phase!=='failed')return false
        this.generation++
        this.abortTrim()
        this.publish({phase:'idle'})
        return true
    }
    reset(){
        this.generation++
        this.abortTrim()
        const recording=this.recording
        const replay=this.replay
        this.recording=undefined
        this.replay=undefined
        this.state={phase:'idle'}
        recording?.stop()
        replay?.dispose()
    }
}
export function downloadWebCapture(blob:Blob,filename:string){
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a')
    try{link.href=url;link.download=filename;document.body.appendChild(link);link.click()}
    finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
}
