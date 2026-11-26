import {canCapture,captureScreenshotBlob,screenshotFilename} from '../../../desktop/renderer/lib/streamcapture'
import {startStreamRecording,recordingFilename} from '../../../desktop/renderer/lib/streamrecording'

export const webRecordingDurations=[60,180,300] as const
export const webRecordingBitrates=[1500000,3000000,6000000] as const
export function webRecordingPreferences(seconds:unknown,videoBitsPerSecond:unknown){
    return {seconds:webRecordingDurations.find(value=>value===seconds)??60,videoBitsPerSecond:webRecordingBitrates.find(value=>value===videoBitsPerSecond)??3000000}
}
export type WebCaptureState={phase:'idle'|'capturing'|'recording'|'stopping'|'ready'|'failed';blob?:Blob;filename?:string}
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
    constructor(private update:(state:WebCaptureState)=>void,private screenshot=captureScreenshotBlob,private record=startStreamRecording){}
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
    startRecording(video:HTMLVideoElement|null,audio:HTMLAudioElement|null,preferences?:{seconds?:unknown;videoBitsPerSecond?:unknown}){
        if(!this.available()||!canCapture(video))return
        const generation=++this.generation
        this.publish({phase:'recording'})
        try{
            const recording=this.record(video,(blob,error)=>{
                if(generation!==this.generation)return
                this.recording=undefined
                this.publish(blob&&!error?{phase:'ready',blob,filename:recordingFilename()}:{phase:'failed'})
            },audio,webRecordingPreferences(preferences?.seconds,preferences?.videoBitsPerSecond))
            if(generation===this.generation&&this.state.phase==='recording')this.recording=recording
            else recording.stop()
        }catch{if(generation===this.generation)this.publish({phase:'failed'})}
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
        this.recording=undefined
        this.state={phase:'idle'}
        recording?.stop()
    }
}
export function downloadWebCapture(blob:Blob,filename:string){
    const url=URL.createObjectURL(blob)
    const link=document.createElement('a')
    try{link.href=url;link.download=filename;document.body.appendChild(link);link.click()}
    finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
}
