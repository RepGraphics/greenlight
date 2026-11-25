import Channel from './channel'
import { MicrophoneLifecycle } from './microphonelifecycle'

export default class ChatChannel extends Channel{
    private microphone?:MicrophoneLifecycle
    private disposed=false
    getChannelName(){return 'chat'}
    getChannelConfig(){return {ordered:true,protocol:'chatV1'}}
    setMicrophone(enabled:boolean,negotiate?:(sdp:RTCSessionDescriptionInit)=>Promise<string>,onEnded?:()=>void){
        if(this.disposed||(!enabled&&!this.microphone))return Promise.resolve(false)
        const player=this.getPlayer()
        this.microphone??=new MicrophoneLifecycle(player._peerConnection,
            ()=>{
                if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone access unavailable')
                return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1}})
            },
            ()=>player.createOffer(),sdp=>player.setRemoteSDP(sdp))
        return this.microphone.setEnabled(enabled,negotiate,onEnded)
    }
    destroy(){this.disposed=true;this.microphone?.dispose()}
}
