type Capture={stream:MediaStream;track:MediaStreamTrack;sender:RTCRtpSender;released:boolean}
type Exchange=(offer:RTCSessionDescriptionInit)=>Promise<string>

// Serialize SDP operations, but stop local capture synchronously when cancelled.
// A pending permission prompt or exchange cannot revive an old microphone.
export class MicrophoneLifecycle{
    private generation=0
    private desired=false
    private disposed=false
    private tail:Promise<unknown>=Promise.resolve()
    private pending?:Promise<boolean>
    private capture?:Capture
    constructor(private peer:RTCPeerConnection,private acquire:()=>Promise<MediaStream>,private createOffer:()=>Promise<RTCSessionDescriptionInit>,private setAnswer:(sdp:string)=>Promise<unknown>){}
    private stop(capture:Capture){
        if(capture.released)return
        capture.released=true
        capture.track.onended=null
        for(const track of capture.stream.getTracks()){track.enabled=false;track.stop()}
    }
    private async release(capture:Capture){
        this.stop(capture)
        if(this.capture===capture)this.capture=undefined
        if(this.peer.signalingState!=='closed'&&capture.sender.track===capture.track)await capture.sender.replaceTrack(null)
    }
    private enqueue(operation:()=>Promise<boolean>){
        const result=this.tail.then(operation)
        this.tail=result.catch(()=>{})
        return result
    }
    setEnabled(enabled:boolean,exchange?:Exchange,onEnded:()=>void=()=>{}):Promise<boolean>{
        if(enabled&&this.disposed)return Promise.resolve(false)
        if(enabled&&this.desired&&this.pending)return this.pending
        if(enabled&&this.desired&&this.capture?.track.enabled&&this.capture.track.readyState==='live')return Promise.resolve(true)
        const epoch=++this.generation
        this.desired=enabled
        const current=()=>!this.disposed&&this.desired&&epoch===this.generation
        if(!enabled){
            const capture=this.capture
            if(capture)this.stop(capture)
            this.pending=undefined
            return this.enqueue(async()=>{if(capture)await this.release(capture);return false})
        }
        const operation=this.enqueue(async()=>{
            if(!current())return false
            const peer=this.peer
            if(!exchange||peer.signalingState!=='stable')throw Error('Microphone negotiation unavailable')
            const sender=peer.getTransceivers().find(item=>item.receiver.track.kind==='audio')?.sender
            if(!sender||sender.track)throw Error('Microphone sender unavailable')
            let capture:Capture|undefined
            let negotiated=false
            try{
                const stream=await this.acquire()
                const track=stream.getAudioTracks()[0]
                if(!current()||!track){
                    for(const item of stream.getTracks()){item.enabled=false;item.stop()}
                    if(!current())return false
                    throw Error('No microphone track')
                }
                // No microphone data can be sent before the remote answer.
                for(const item of stream.getTracks())item.enabled=false
                capture={stream,track,sender,released:false}
                this.capture=capture
                track.onended=()=>{
                    if(!current()||this.capture!==capture)return
                    void this.setEnabled(false).catch(()=>{})
                    onEnded()
                }
                await sender.replaceTrack(track)
                if(!current())return false
                const offer=await this.createOffer()
                if(!current())return false
                if(!offer.sdp)throw Error('Missing chat offer')
                const answer=await exchange(offer)
                if(!current())return false
                if(typeof answer!=='string'||!answer)throw Error('Invalid chat answer')
                await this.setAnswer(answer)
                if(!current())return false
                if(track.readyState!=='live')throw Error('Microphone ended')
                track.enabled=true;negotiated=true
                return true
            }catch(error){
                if(current())throw error
                return false
            }finally{
                if(!negotiated){
                    try{if(capture)await this.release(capture)}
                    finally{
                        // Also roll back cancelled exchanges, not only rejected ones.
                        if((peer.signalingState as RTCSignalingState)==='have-local-offer')await peer.setLocalDescription({type:'rollback'}).catch(()=>{})
                    }
                }
            }
        })
        const result=operation.finally(()=>{if(this.pending===result)this.pending=undefined})
        this.pending=result
        return result
    }
    dispose(){
        if(this.disposed)return
        this.disposed=true
        void this.setEnabled(false).catch(()=>{})
    }
}
