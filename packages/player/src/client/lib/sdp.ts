import xCloudPlayer from './player'

export default class Sdp {
    private _player: xCloudPlayer
    private _peerConnection:RTCPeerConnection

    constructor(player:xCloudPlayer) {
        this._player = player
        this._peerConnection = player._peerConnection
    }

    getAvailableCodecs():Array<any> {
        const capabilities = RTCRtpReceiver.getCapabilities('video')?.codecs
        if(capabilities === undefined) {return []}

        const codecs:Array<string> = []
        for(const codec in capabilities) {
            if(!codecs.includes(capabilities[codec].mimeType)) {codecs.push(capabilities[codec].mimeType)}
        }

        return codecs
    }

    // getServerCodecs() {
    //     for(const sender in this._peerConnection.getSenders()){
    //         console.log('Sender:', this._peerConnection.getSenders()[sender])
    //     }
    // }

    setLocalSDP(sdp:RTCSessionDescriptionInit, bitrate = 0) {
        if (sdp.sdp && Number.isFinite(bitrate) && bitrate > 0) {
            sdp.sdp = this._setBitrate(sdp.sdp, 'video', Math.min(40960, Math.floor(bitrate)))
        }

        // if(this._player._config.video_bitrate > 0){
        //     console.log('[SDP] Set max video bitrate to:', this._player._config.video_bitrate, 'kbps')
        //     sdp.sdp = this._setBitrate(sdp.sdp, 'video', this._player._config.video_bitrate)
        // }

        // if(this._player._config.audio_bitrate > 0){
        //     console.log('[SDP] Set max audio bitrate to:', this._player._config.audio_bitrate, 'kbps')
        //     sdp.sdp = this._setBitrate(sdp.sdp, 'audio', this._player._config.audio_bitrate)
        // }

        // if(this._player._config.audio_mono !== true){
        //     console.log('[SDP] setLocalSDP() Set audio to stereo')
        //     sdp.sdp = sdp.sdp?.replace('useinbandfec=1', 'useinbandfec=1; stereo=1')
        // }

        sdp.sdp = sdp.sdp?.replace('useinbandfec=1', 'useinbandfec=1; stereo=1')

        return sdp
    }

    setRemoteSDP(sdp:string) {
        return sdp
    }

    getDefaultCodecPreferences(profiles: string[] = []) {
        const capabilities = RTCRtpReceiver.getCapabilities('video')?.codecs
        if(capabilities === undefined) {return []}

        const t1:Array<any> = []
        const t2:Array<any> = []
        const t3:Array<any> = []
        const t4:Array<any> = []

        for(const codec in capabilities) {
            if(capabilities[codec].mimeType.includes('H264')) {
                if(capabilities[codec].sdpFmtpLine?.includes('profile-level-id=4d')) {
                    t1.push(capabilities[codec])

                } else if(capabilities[codec].sdpFmtpLine?.includes('profile-level-id=42e')) {
                    t2.push(capabilities[codec])

                } else if(capabilities[codec].sdpFmtpLine?.includes('profile-level-id=420')) {
                    t3.push(capabilities[codec])
                } 
            } else if(capabilities[codec].mimeType.includes('ulpfec')) {
                t4.push(capabilities[codec])
            } else if(capabilities[codec].mimeType.includes('flexfec')) {
                t4.push(capabilities[codec])
            } else if(capabilities[codec].mimeType.includes('VP9')) {
                t4.push(capabilities[codec])
            } else if(capabilities[codec].mimeType.includes('VP8')) {
                t4.push(capabilities[codec])
            }
            // else {
            //     t4.push(capabilities[codec])
            // }
        }

        const codecOrder = [...t1, ...t2, ...t3, ...t4]

        const preferred = codecOrder.filter(codec => codec.mimeType.toLowerCase() === 'video/h264' && profiles.some(profile => ['4d', '42e', '420'].includes(profile) && codec.sdpFmtpLine?.includes('profile-level-id=' + profile)))
        return [...preferred, ...codecOrder.filter(codec => !preferred.includes(codec))]
    }

    _setBitrate(sdp: string, media: string, bitrate: number) {
        const lines = sdp.split(/\r?\n/)
        const start = lines.findIndex(line => line.startsWith('m=' + media + ' '))
        if (start < 0) return sdp
        let end = start + 1
        while (end < lines.length && !lines[end].startsWith('m=')) end++
        const section = lines.slice(start, end).filter(line => !/^b=(AS|TIAS):/.test(line))
        let insert = 1
        while (insert < section.length && /^(i|c)=/.test(section[insert])) insert++
        section.splice(insert, 0, 'b=AS:' + bitrate)
        return [...lines.slice(0, start), ...section, ...lines.slice(end)].join('\r\n')
    }
}
