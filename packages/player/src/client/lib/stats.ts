import xCloudPlayer from './player'
import { MediaStallMonitor } from './mediastall'

export default class Stats {
    private _player: xCloudPlayer
    private _peerConnection:RTCPeerConnection
    private timer: ReturnType<typeof setInterval>
    private disposed = false
    private busy = false
    private mediaMonitor = new MediaStallMonitor()
    mediaStalled = false
    lastStatsAt = 0
    private requestGeneration=0
    private requestStarted=0
    private replacedPending=false
    private lastReportTimestamp=0
    private previous?: { id: string; bytes: number; time: number }
    _bitrate = 0
    _jitter = 0
    _packetsLost = 0

    _videoCodec:string = ''
    _audioCodec:string = ''

    _videoWidth:number = 0
    _videoHeight:number = 0
    _videoFps:number = 0
    _rtt:number = 0.0

    _remoteHost:string = ''
    _remotePort:number = 0
    _remoteIsLocal = false
    _remoteIsIpv6 = false
    _activeRemoteCandidate:string = ''

    constructor(player:xCloudPlayer) {
        this._player = player
        this._peerConnection = player._peerConnection

        this.timer = setInterval(this.loop.bind(this), 1000)
    }

    destroy() { this.disposed = true; clearInterval(this.timer) }

    loop(){
        if (this.disposed) return
        if(this.busy && performance.now()-this.requestStarted<5000)return
        // At most one replacement request; a hung native getStats promise cannot be cancelled.
        if(this.busy && this.replacedPending)return
        if(this.busy)this.replacedPending=true
        this.busy = true
        this.requestStarted=performance.now()
        const generation=++this.requestGeneration
        this._peerConnection.getStats().then((stats) => {
            if (this.disposed || generation!==this.requestGeneration) return
            let latest=0
            stats.forEach(report=>{if(report.type==='inbound-rtp'&&Number.isFinite(report.timestamp))latest=Math.max(latest,report.timestamp)})
            if(latest<=this.lastReportTimestamp)return
            this.lastReportTimestamp=latest
            this.lastStatsAt=performance.now()
            const inbound=Array.from(stats.values()).filter(r=>r.type==='inbound-rtp'&&(r.kind==='video'||r.kind==='audio')).map(r=>({id:r.id,bytes:r.bytesReceived}))
            this.mediaStalled=this.mediaMonitor.sample(this.lastStatsAt,inbound,this._peerConnection.connectionState==='connected'&&!document.hidden)
            const transport = Array.from(stats.values()).find(report=>report.type==='transport'&&report.selectedCandidatePairId)
            const selectedPair = transport ? stats.get(transport.selectedCandidatePairId) : undefined
            stats.forEach((report) => {
                //  @TODO: Implement chat stats using type outbound-rtp

                if(report.type === 'inbound-rtp'){
                    this.readInboundRtp(report)
                    if (report.kind === 'video') {
                        const codec = stats.get(report.codecId)
                        if (codec?.mimeType) this._videoCodec = codec.mimeType
                        const old = this.previous
                        if (old && old.id === report.id && report.timestamp > old.time && report.bytesReceived >= old.bytes) this._bitrate = (report.bytesReceived - old.bytes) * 8 / (report.timestamp - old.time) / 1000
                        if (typeof report.bytesReceived === 'number') this.previous = { id: report.id, bytes: report.bytesReceived, time: report.timestamp }
                        this._jitter = (report.jitter || 0) * 1000
                        this._packetsLost = report.packetsLost || 0
                    }

                } else if(report.type === 'candidate-pair' && (selectedPair ? report.id===selectedPair.id : report.nominated && report.state==='succeeded')){
                    this.readCandidatePair(report)
                    
                } else if(report.type === 'remote-candidate'){
                    this.readRemoteCandidate(report)
                }
            })
        }).catch(() => {}).finally(() => { if(generation===this.requestGeneration){this.busy=false;this.replacedPending=false} })
    }

    readInboundRtp(report:RTCInboundRtpStreamStats){
        if(report.kind === 'video' && report.codecId && report.packetsReceived !== undefined && report.packetsReceived > 0){

            if(report.codecId.includes('profile-level-id=4d')){
                this._videoCodec = 'H264 (High)'

            } else if(report.codecId.includes('profile-level-id=42e')) {
                this._videoCodec = 'H264 (Normal)'

            } else if(report.codecId.includes('profile-level-id=420')) {
                this._videoCodec = 'H264 (Low)'

            } else {
                this._videoCodec = 'Other ('+report.codecId+')'
            }

            if(report.frameWidth){ this._videoWidth = report.frameWidth }
            if(report.frameHeight){ this._videoHeight = report.frameHeight }
            if(typeof report.framesPerSecond==='number'){ this._videoFps = report.framesPerSecond }
            // report.jitter

        } else if(report.kind === 'audio' && report.codecId && report.packetsReceived !== undefined && report.packetsReceived > 0){
            this._audioCodec = report.codecId

            // report.jitter
        }
    }

    readCandidatePair(report){
        this._activeRemoteCandidate = report.remoteCandidateId
        this._rtt = Number.isFinite(report.currentRoundTripTime)?report.currentRoundTripTime:0
    }

    readRemoteCandidate(report){
        if(report.id !== this._activeRemoteCandidate || typeof report.address !== 'string') {return}

        if(this.isPrivateIP(report.address)){
            this._remoteIsLocal = true
        } else {
            this._remoteIsLocal = false
        }

        if(this.isIpv6(report.address)){
            this._remoteIsIpv6 = true
        } else {
            this._remoteIsIpv6 = false
        }

        this._remoteHost = report.address
        this._remotePort = report.port
    }

    isPrivateIP(ip) {
        const parts = ip.split('.')
        return parts[0] === '10' || (parts[0] === '172' && (parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31)) || (parts[0] === '192' && parts[1] === '168')
    }

    isIpv6(ip) {
        const parts = ip.split(':')
        return parts.length > 3 ? true : false
    }
}