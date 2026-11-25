import type xCloudPlayer from '../player'

export interface PlaybackPreferences{volume:number;muted:boolean}
export function normalizePlayback(volume:number,muted:boolean):PlaybackPreferences{
    return {volume:Number.isFinite(volume)?Math.max(0,Math.min(1,volume)):1,muted:Boolean(muted)}
}

// Playback preferences belong to the player, not a transient audio element.
// Apply them before attaching a remote track, including after replacement.
export default class AudioComponent{
    private element?:HTMLAudioElement
    private preferences:PlaybackPreferences
    constructor(private player:xCloudPlayer,volume=1,muted=false){
        this.preferences=normalizePlayback(volume,muted)
    }
    setPlayback(volume:number,muted:boolean){
        this.preferences=normalizePlayback(volume,muted)
        if(this.element){
            this.element.volume=this.preferences.volume
            this.element.muted=this.preferences.muted
        }
    }
    create(stream:MediaStream){
        this.destroy()
        const holder=document.getElementById(this.player.getElementId())
        if(!holder)return
        const audio=document.createElement('audio')
        audio.volume=this.preferences.volume
        audio.muted=this.preferences.muted
        audio.autoplay=true
        this.element=audio
        audio.srcObject=stream
        holder.appendChild(audio)
    }
    getElement(){return this.element}
    destroy(){
        const audio=this.element
        this.element=undefined
        if(!audio)return
        audio.pause()
        audio.srcObject=null
        audio.remove()
    }
}
