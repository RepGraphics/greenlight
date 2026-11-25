// Own microphone tracks independently of the upstream Classic chat adapter.
type Capture={stream:MediaStream;track:MediaStreamTrack;sender:RTCRtpSender;abort:AbortController;released:boolean}
export class ClassicMicrophone{
    private disposed=false
    private pending=false
    private capture:Capture|undefined
    private permission:AbortController|undefined
    constructor(private peer:RTCPeerConnection,private acquire:()=>Promise<MediaStream>,private negotiate:(signal:AbortSignal)=>Promise<void>,private onEnded:()=>void=()=>{}){}
    get busy(){return this.pending}
    get active(){return Boolean(this.capture?.track.enabled)}
    private release(capture:Capture){
        capture.abort.abort()
        if(!capture.released){
            capture.released=true
            capture.track.onended=null
            capture.stream.getTracks().forEach(track=>{track.enabled=false;track.stop()})
        }
        if(this.capture===capture)this.capture=undefined
        if(this.peer.signalingState!=='closed'&&capture.sender.track===capture.track)return capture.sender.replaceTrack(null).catch(()=>{})
        return Promise.resolve()
    }
    async enable(){
        if(this.disposed||this.pending)return false
        if(this.active)return true
        if(this.peer.signalingState!=='stable')throw Error('Microphone negotiation unavailable')
        const sender=this.peer.getTransceivers().find(item=>item.receiver.track.kind==='audio')?.sender
        if(!sender||sender.track)throw Error('Microphone sender unavailable')
        const abort=new AbortController()
        this.permission=abort;this.pending=true
        let capture:Capture|undefined
        try{
            const stream=await this.acquire()
            if(this.disposed||abort.signal.aborted){stream.getTracks().forEach(track=>track.stop());return false}
            const track=stream.getAudioTracks()[0]
            if(!track){stream.getTracks().forEach(item=>item.stop());throw Error('No microphone track')}
            track.enabled=false
            capture={stream,track,sender,abort,released:false}
            this.capture=capture
            track.onended=()=>{void this.release(capture!);this.onEnded()}
            await sender.replaceTrack(track)
            if(this.disposed||abort.signal.aborted){await this.release(capture);return false}
            await this.negotiate(abort.signal)
            if(this.disposed||abort.signal.aborted){await this.release(capture);return false}
            if(track.readyState!=='live')throw Error('Microphone ended')
            track.enabled=true;return true
        }catch(error){
            if(capture)await this.release(capture)
            if(this.disposed)return false
            throw error
        }finally{this.pending=false;if(this.permission===abort)this.permission=undefined}
    }
    async disable(){
        if(this.pending)return
        this.pending=true
        try{if(this.capture)await this.release(this.capture)}
        finally{this.pending=false}
    }
    dispose(){
        this.disposed=true;this.permission?.abort()
        if(this.capture)void this.release(this.capture)
    }
}
export function classicChatOffer(sdp:string,cap:number){
    let result=sdp.replace('useinbandfec=1','useinbandfec=1; stereo=1')
    if(!Number.isFinite(cap)||cap<=0)return result
    const lines=result.split(/\r?\n/)
    const start=lines.findIndex(line=>line.startsWith('m=video '))
    if(start<0)return result
    let end=start+1
    while(end<lines.length&&!lines[end].startsWith('m='))end++
    const section=lines.slice(start,end).filter(line=>!/^b=(AS|TIAS):/.test(line))
    let insert=1
    while(insert<section.length&&/^(i|c)=/.test(section[insert]))insert++
    section.splice(insert,0,'b=AS:'+Math.min(40960,Math.floor(cap)))
    result=[...lines.slice(0,start),...section,...lines.slice(end)].join('\r\n')
    return result
}
export async function negotiateClassicChat(peer:RTCPeerConnection,cap:number,exchange:(sdp:string)=>Promise<unknown>,signal:AbortSignal){
    const check=()=>{if(signal.aborted||peer.signalingState==='closed')throw Error('Microphone negotiation cancelled')}
    try{
        check()
        const offer=await peer.createOffer()
        check()
        if(!offer.sdp)throw Error('Missing chat offer')
        const sdp=classicChatOffer(offer.sdp,cap)
        await peer.setLocalDescription({type:'offer',sdp})
        check()
        const answer=await exchange(sdp)
        check()
        if(typeof answer!=='string'||!answer)throw Error('Invalid chat answer')
        await peer.setRemoteDescription({type:'answer',sdp:answer})
        check()
    }catch(error){
        if(peer.signalingState==='have-local-offer')await peer.setLocalDescription({type:'rollback'}).catch(()=>{})
        throw error
    }
}
