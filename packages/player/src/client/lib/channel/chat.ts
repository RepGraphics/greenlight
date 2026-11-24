import Channel from './channel'

export default class ChatChannel extends Channel {
    private stream?: MediaStream
    private disposed = false
    private operation = 0

    getChannelName() { return 'chat' }
    getChannelConfig() { return { ordered: true, protocol: 'chatV1' } }

    async setMicrophone(enabled: boolean, negotiate?: (sdp: RTCSessionDescriptionInit) => Promise<string>) {
        const request = ++this.operation
        const peer = this.getPlayer()._peerConnection
        const sender = peer.getTransceivers().find(item => item.receiver.track.kind === 'audio')?.sender
        if (!enabled) {
            this.stream?.getTracks().forEach(track => track.stop())
            this.stream = undefined
            if (sender && peer.signalingState !== 'closed') await sender.replaceTrack(null)
            return false
        }
        if (this.disposed || !sender || !negotiate || peer.signalingState !== 'stable') throw new Error('Microphone unavailable')
        if (this.stream) return true
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access unavailable')
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
        if (this.disposed || request !== this.operation) { stream.getTracks().forEach(track => track.stop()); return false }
        const track = stream.getAudioTracks()[0]
        if (!track) { stream.getTracks().forEach(item => item.stop()); throw new Error('No microphone track') }
        track.enabled = false
        this.stream = stream
        try {
            await sender.replaceTrack(track)
            if (this.disposed || request !== this.operation) return false
            const offer = await this.getPlayer().createOffer()
            const answer = await negotiate(offer)
            if (this.disposed || request !== this.operation) return false
            if (typeof answer !== 'string' || !answer) throw new Error('Invalid chat SDP answer')
            await this.getPlayer().setRemoteSDP(answer)
            if (this.disposed || request !== this.operation) return false
            track.enabled = true
            return true
        } catch (error) {
            stream.getTracks().forEach(item => item.stop())
            if (this.stream === stream) this.stream = undefined
            const signalingState = (): RTCSignalingState => peer.signalingState
            if (signalingState() !== 'closed' && sender.track === track) await sender.replaceTrack(null).catch(() => {})
            if (signalingState() === 'have-local-offer') await peer.setLocalDescription({ type: 'rollback' }).catch(() => {})
            throw error
        }
    }

    destroy() {
        this.disposed = true
        ++this.operation
        this.stream?.getTracks().forEach(track => track.stop())
        this.stream = undefined
    }
}
