import {recordingMimeType} from '../../../desktop/renderer/lib/streamrecording'

export type CapabilityState='available'|'unavailable'|'unknown'
export type DeviceCapabilities={
    secure:boolean;webrtc:boolean;h264:CapabilityState;gamepad:boolean;touch:boolean;
    microphone:boolean;recording:boolean;fullscreen:boolean;pip:boolean;wakeLock:boolean;clipboard:boolean
}
export function videoCodecCapability(receiver:{getCapabilities?:(kind:'video')=>{codecs:readonly {mimeType:string}[]}|null}|undefined):CapabilityState{
    try{
        const codecs=receiver?.getCapabilities?.('video')?.codecs
        if(!codecs)return 'unknown'
        return codecs.some(codec=>codec.mimeType.toLowerCase()==='video/h264')?'available':'unavailable'
    }catch{return 'unknown'}
}
export function detectDeviceCapabilities():DeviceCapabilities{
    const secure=window.isSecureContext===true
    let recording=false
    try{recording=Boolean(recordingMimeType())}catch{}
    return {
        secure,webrtc:typeof RTCPeerConnection==='function',
        h264:videoCodecCapability(typeof RTCRtpReceiver==='undefined'?undefined:RTCRtpReceiver),
        gamepad:typeof navigator.getGamepads==='function',
        touch:navigator.maxTouchPoints>0,
        microphone:secure&&typeof navigator.mediaDevices?.getUserMedia==='function',
        recording:recording&&typeof MediaStream==='function',
        fullscreen:document.fullscreenEnabled===true&&typeof document.documentElement.requestFullscreen==='function',
        pip:document.pictureInPictureEnabled===true&&typeof HTMLVideoElement.prototype.requestPictureInPicture==='function',
        wakeLock:secure&&typeof navigator.wakeLock?.request==='function',
        clipboard:secure&&typeof navigator.clipboard?.writeText==='function',
    }
}
export function capabilityRows(value:DeviceCapabilities):{label:string;state:CapabilityState}[]{
    const state=(available:boolean):CapabilityState=>available?'available':'unavailable'
    return [
        {label:'Secure context',state:state(value.secure)},
        {label:'WebRTC peer connection',state:state(value.webrtc)},
        {label:'H.264 advertised receive capability',state:value.h264},
        {label:'Gamepad API',state:state(value.gamepad)},
        {label:'Touch input detected',state:state(value.touch)},
        {label:'Microphone API',state:state(value.microphone)},
        {label:'WebM recording API',state:state(value.recording)},
        {label:'Browser fullscreen API',state:state(value.fullscreen)},
        {label:'Picture-in-picture API',state:state(value.pip)},
        {label:'Screen wake lock API',state:state(value.wakeLock)},
        {label:'Clipboard API',state:state(value.clipboard)},
    ]
}
export function capabilityReport(value:DeviceCapabilities){
    return ['Greenlight V3 browser capability report',...capabilityRows(value).map(row=>row.label+': '+row.state),'API presence only; no permission, device, codec playback or Xbox session tested.'].join('\n')
}
