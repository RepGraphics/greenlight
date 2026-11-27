import xCloudPlayer from './player'

export default class Ice {
    private _peerConnection:RTCPeerConnection
    private _iceCandidates: RTCIceCandidate[] = []

    constructor(player:xCloudPlayer) {
        this._peerConnection = player._peerConnection

        this._peerConnection.addEventListener('icecandidate', event => {
            if(event.candidate) {
                this._iceCandidates.push(event.candidate)

                // @TODO: Implement Teredo port selection for remote streaming
            }
        })
    }

    getCandidates(){
        return this._iceCandidates
    }

    async waitForCandidates() {
        if (this._peerConnection.iceGatheringState === 'complete') return this.getCandidates()
        await new Promise<void>(resolve => {
            const finish = () => { clearTimeout(timer); this._peerConnection.removeEventListener('icegatheringstatechange', check); resolve() }
            const check = () => { if (this._peerConnection.iceGatheringState === 'complete') finish() }
            const timer = setTimeout(finish, 5000)
            this._peerConnection.addEventListener('icegatheringstatechange', check)
            check()
        })
        return this.getCandidates()
    }

    async setRemoteCandidates(candidates:RTCIceCandidate[]){
        if(candidates.length === 0){
            console.warn('Error: No candidates received!')
        }

        // The Xbox session API supplies compatibility routes before its end marker.
        for(const entry of candidates){
            if(typeof entry?.candidate!=='string')continue
            const line=entry.candidate.trim().replace(/^a=/,'')
            const candidate=line==='end-of-candidates'?'':line
            await this._peerConnection.addIceCandidate({
                candidate,
                sdpMid:entry.sdpMid,
                sdpMLineIndex:entry.sdpMLineIndex,
            }).catch(()=>{})
        }
    }
}
