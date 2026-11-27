import {canCapture,captureScreenshotBlob,screenshotFilename} from '../../../desktop/renderer/lib/streamcapture'
import {startStreamRecording,recordingFilename} from '../../../desktop/renderer/lib/streamrecording'

import {startInstantReplay,replayDuration,replayMaxBytes} from '../../../desktop/renderer/lib/instantreplay'

import {webRecordingPreferences} from '../../shared/recordingpreferences'
export {webReplayDurations, webRecordingDurations, webRecordingBitrates, webRecordingPreferences} from '../../shared/recordingpreferences'
export type WebCaptureState={phase:'idle'|'capturing'|'recording'|'stopping'|'replay'|'savingReplay'|'ready'|'failed';blob?:Blob;filename?:string;replayReady?:boolean}
export function webCaptureMedia(surface:HTMLElement|null){
    const video=surface?.querySelector<HTMLVideoElement>('#playerContainer video')??null
    const audio=surface?.querySelector<HTMLAudioElement>('#playerContainer audio')??null
    return {video:canCapture(video)?video:null,audio}
}

// At most one capture, scoped to the mounted connected player. Never trigger
// a download from an asynchronous completion or keep media after disposal.
export class WebCaptureSession{
    private generation=0
    private state:WebCaptureState={phase:'idle'}
    private recording?:{stop:()=>void}
    private replay?:ReturnType<typeof startInstantReplay>
    constructor(private update:(state:WebCaptureState)=>void,private screenshot=captureScreenshotBlob,private record=startStreamRecording,private beginReplay=startInstantReplay){}
    private publish(state:WebCaptureState){this.state=state;this.update(state)}
    private available(){return ['idle','ready','failed'].includes(this.state.phase)}
    async takeScreenshot(video:HTMLVideoElement|null){
        if(!this.available()||!canCapture(video))return
        const generation=++this.generation
        this.publish({phase:'capturing'})
        try{
            const blob=await this.screenshot(video)
            if(generation===this.generation)this.publish({phase:'ready',blob,filename:screenshotFilename()})
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
                this.publish(blob&&!error?{phase:'ready',blob,filename:recordingFilename()}:{phase:'failed'})
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
        this.publish(blob&&blob.size>0&&blob.size<=replayMaxBytes&&blob.type.startsWith('video/webm')?{phase:'ready',blob,filename:recordingFilename()}:{phase:'failed'})
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
        this.recording.stop()
    }
    discard(){
        if(this.state.phase!=='ready'&&this.state.phase!=='failed')return false
        this.generation++
        this.publish({phase:'idle'})
        return true
    }
    reset(){
        this.generation++
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
