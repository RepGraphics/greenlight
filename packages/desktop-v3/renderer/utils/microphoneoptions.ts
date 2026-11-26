export type WebMicrophoneState='off'|'requesting'|'active'|'failed'
export function webMicrophoneSupported(secure:boolean,mediaDevices?:{getUserMedia?:unknown}):boolean{
    return secure&&typeof mediaDevices?.getUserMedia==='function'
}
export function microphoneRequested(state:WebMicrophoneState):boolean{
    return state==='requesting'||state==='active'
}
export function toggleWebMicrophone(state:WebMicrophoneState,available:boolean,connected:boolean):WebMicrophoneState{
    if(microphoneRequested(state))return 'off'
    return available&&connected?'requesting':'off'
}
export function webMicrophoneResult(state:WebMicrophoneState,active:boolean,error=false):WebMicrophoneState{
    if(!microphoneRequested(state))return state
    return error||!active?'failed':'active'
}
