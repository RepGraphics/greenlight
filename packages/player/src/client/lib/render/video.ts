import xCloudPlayer from '../player'
import Overlay from './overlay'
import {PlaybackFrameProgress} from './frameprogress'

export default class VideoComponent {
    private _player:xCloudPlayer

    private _element:HTMLVideoElement | undefined
    private _overlay:Overlay
    private frameCallback?: number
    private lastFrameAt = 0
    private callbackActive=false
    private fallbackProgress=new PlaybackFrameProgress()
    private resume = () => { if (this._element?.paused) void this._element.play().catch(()=>{}) }

    getLastFrameAt(){
        if(this.callbackActive)return this.lastFrameAt
        try{return this.fallbackProgress.sample(performance.now(),this._element?.getVideoPlaybackQuality?.())}
        catch{this.fallbackProgress.reset();return undefined}
    }
    recover(){ this.resume(); this._player._channels.control.requestKeyframeRequest(true) }

    constructor(player:any){
        this._player = player
        this._overlay = new Overlay(this, this._player)
    }

    create(stream:MediaStream) {
        this.destroy()
        const videoElement = document.createElement('video')
        videoElement.srcObject = stream
        videoElement.autoplay = true
        videoElement.muted = true
        videoElement.playsInline = true
        videoElement.style.width = '100%'
        videoElement.style.height = '100%'
        videoElement.style.objectFit = 'contain'
        videoElement.style.backgroundColor = 'black'
        videoElement.style.touchAction = 'none'

        const element = document.getElementById(this._player.getElementId())
        if(element === null) {return}

        this.lastFrameAt = performance.now()
        this._element = videoElement
        videoElement.addEventListener('pause', this.resume)
        videoElement.addEventListener('canplay', this.resume)
        void videoElement.play().catch(()=>{})
        element.appendChild(this._element)
        const isStatic = getComputedStyle(element).position === 'static' ? true : false
        if(isStatic === true){
            element.style.position = 'relative'
        }

        this.scheduleFrame(videoElement)
    }

    private scheduleFrame(element:HTMLVideoElement){
        this.callbackActive=false
        if(typeof element.requestVideoFrameCallback!=='function'||typeof element.cancelVideoFrameCallback!=='function')return
        try{
            this.frameCallback=element.requestVideoFrameCallback((_timestamp,data)=>{
                if(this._element!==element||!this.callbackActive)return
                this.frameCallback=undefined
                this.lastFrameAt=performance.now()
                this.scheduleFrame(element)
                this.processVideoMetadata(data)
            })
            this.callbackActive=true
        }catch{this.callbackActive=false;this.frameCallback=undefined;this.fallbackProgress.reset()}
    }

    private processVideoMetadata(data:VideoFrameCallbackMetadata) {

        this._player._channels.input.queueMetadataFrame({
            serverDataKey: data.rtpTimestamp as number,
            firstFramePacketArrivalTimeMs: data.receiveTime as number,
            frameSubmittedTimeMs: data.receiveTime as number,
            frameDecodedTimeMs: data.expectedDisplayTime,
            frameRenderedTimeMs: data.expectedDisplayTime,
        })
    }

    getElement(){
        return this._element
    }

    toggleDebugOverlay(){
        this._overlay.toggleDebug()
    }

    destroy(){
        const element = this._element
        this._element = undefined
        this.callbackActive=false
        if (element && this.frameCallback !== undefined) {
            try{element.cancelVideoFrameCallback(this.frameCallback)}catch{}
        }
        this.frameCallback=undefined
        this.fallbackProgress.reset()
        if (element) { element.removeEventListener('pause',this.resume); element.removeEventListener('canplay',this.resume); element.pause(); element.srcObject = null }

        if(this._overlay !== undefined){
            this._overlay.destroy()
        }

        if(element){
            element.remove()
        }
    }
}