import ChatChannel from './channel/chat'
import ControlChannel from './channel/control'
import InputChannel from './channel/input'
import MessageChannel from './channel/message'

import Ice from './ice'
import Sdp from './sdp'
import Stats from './stats'

import VideoComponent from './render/video'
import WebGpuComponent from './render/webgpu'
import AudioComponent from './render/audio'

export default class xCloudPlayer {

    _peerConnection = new RTCPeerConnection({})
    _channels = {
        input: new InputChannel(this),
        chat: new ChatChannel(this),
        control: new ControlChannel(this),
        message: new MessageChannel(this),
    }

    private _elementId: string
    private _isDestoyed: boolean = false
    serverDisconnected = false
    private _iceHelper = new Ice(this)
    private _sdpHelper = new Sdp(this)
    private _statsHelper = new Stats(this)

    private _videoComponent: VideoComponent | WebGpuComponent | undefined
    private _audioComponent: AudioComponent | undefined
    private videoWatchdog: ReturnType<typeof setInterval> | undefined
    private lastVideoRecovery = 0
    private videoReceivedAt = 0
    private videoStream: MediaStream | undefined

    constructor(elementId: string, useWebGpu = true, private videoBitrate = 0, profiles: string[] = []) {
        console.log('xCloudPlayer constructing...');

        this._elementId = elementId;
        this._peerConnection.addTransceiver('audio', { direction: 'sendrecv' })
        const videoTransceiver = this._peerConnection.addTransceiver('video', { direction: 'recvonly' })
        const codecs = this._sdpHelper.getDefaultCodecPreferences(profiles)
        if (profiles.length && codecs.length) videoTransceiver.setCodecPreferences(codecs)

        this._peerConnection.ontrack = (event) => {

            if(event.track.kind === 'video'){
                // this._videoComponent = new VideoComponent(this)
                this._videoComponent?.destroy()
                const stream = event.streams[0] || new MediaStream([event.track])
                this.videoStream = stream
                this.videoReceivedAt = performance.now()
                this.lastVideoRecovery = 0
                const fallback = () => {
                    if (this._isDestoyed) return
                    this._videoComponent?.destroy()
                    this._videoComponent = new VideoComponent(this)
                    this._videoComponent.create(stream)
                }
                if (useWebGpu && navigator.gpu && typeof MediaStreamTrackProcessor !== 'undefined') {
                    const gpu = new WebGpuComponent(this)
                    this._videoComponent = gpu
                    gpu.create(stream, () => { if (this._videoComponent === gpu) fallback() })
                } else fallback()

            } else if(event.track.kind === 'audio'){
                this._audioComponent?.destroy()
                this._audioComponent = new AudioComponent(this)
                this._audioComponent.create(event.streams[0] || new MediaStream([event.track]))

            } else {
                console.log('[xPlayer] Detected an unknown stream type: ', event.track.kind)
            }
        }

        this.videoWatchdog = setInterval(()=>{
            if(this._isDestoyed || this._peerConnection.connectionState!=='connected' || document.hidden) return
            const video=this._videoComponent
            if(video instanceof VideoComponent && performance.now()-video.getLastFrameAt()>5000 && performance.now()-this.lastVideoRecovery>5000){
                this.lastVideoRecovery=performance.now();video.recover()
            } else if(video instanceof WebGpuComponent && this.videoStream && performance.now()-this.videoReceivedAt>10000 && video.getFrameStats().renderingFps===0){
                video.destroy();this._videoComponent=new VideoComponent(this);this._videoComponent.create(this.videoStream);this._channels.control.requestKeyframeRequest(true)
            } else if(!video && performance.now()-this.lastVideoRecovery>5000){
                this.lastVideoRecovery=performance.now();this._channels.control.requestKeyframeRequest(true)
            }
        },2000)
        console.log('xCloudPlayer constructed.');
    }

    init() {
        console.log('xCloudPlayer init called.');
    }

    getElementId() {
        return this._elementId
    }

    async createOffer() {
        const offer = await this._peerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        })
        const finalOffer = this._sdpHelper.setLocalSDP(offer, this.videoBitrate)
        await this._peerConnection.setLocalDescription(finalOffer)

        return finalOffer
    }

    async setRemoteSDP(sdp: string) {
        const finalSdp = this._sdpHelper.setRemoteSDP(sdp)
        return await this._peerConnection.setRemoteDescription({
            type: 'answer',
            sdp: finalSdp,
        })
    }

    async getICECandidates() {
        return await this._iceHelper.waitForCandidates()
    }

    async setRemoteIceCandidates(candidates:RTCIceCandidate[]) {
        // @TODO: Sort ipv4 and ipv6, and use best route as preference (ipv6 only etc)

        await this._iceHelper.setRemoteCandidates(candidates)
    }

    getVideoElement() {
        if(this._videoComponent){
            return this._videoComponent.getElement()
        } else {
            return undefined
        }
    }

    getAudioElement() {
        if(this._audioComponent){
            return this._audioComponent.getElement()
        } else {
            return undefined
        }
    }

    toggleDebugOverlay() {
        if(this._videoComponent){
            this._videoComponent.toggleDebugOverlay()
        }
    }

    getStats() {
        return this._statsHelper
    }

    destroy() {
        if(this._isDestoyed === false){
            this._isDestoyed = true
            clearInterval(this.videoWatchdog)
            this._statsHelper.destroy()
            this._peerConnection.ontrack = null
            this._peerConnection.close()

            if(this._peerConnection.onconnectionstatechange){
                this._peerConnection.onconnectionstatechange(new Event('connectionstatechanged'))
            }
            
            for(const channel in this._channels) {
                try { this._channels[channel].destroy() } catch { /* continue teardown */ }
            }

            if(this._videoComponent){ this._videoComponent.destroy() }
            if(this._audioComponent){ this._audioComponent.destroy() }

            this._isDestoyed = true
        } else {
            console.log('Cannot destroy because the player is already destroyed.')
        }
    }
}