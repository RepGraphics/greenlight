import type xCloudPlayer from './player'
import {StatsPoller} from './statspoller'
import { MediaStallMonitor } from './mediastall'

export default class Stats {
    private _player: xCloudPlayer
    private _peerConnection:RTCPeerConnection
    private timer: ReturnType<typeof setInterval>
    private poller:StatsPoller<RTCStatsReport>
    private mediaMonitor = new MediaStallMonitor()
    mediaStalled = false
    lastStatsAt = 0
    private lastReportTimestamp=0
    private lastVideoTimestamp=0
    lastVideoStatsAt=0
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

        this.poller=new StatsPoller(()=>this._peerConnection.getStats(),(stats,now)=>this.consume(stats,now))
        this.timer = setInterval(this.loop.bind(this), 1000)
    }

    destroy() { this.poller.dispose(); clearInterval(this.timer) }

    loop(){this.poller.tick()}

    private consume(stats:RTCStatsReport,now:number){
            let latest=0
            stats.forEach(report=>{if(report.type==='inbound-rtp'&&Number.isFinite(report.timestamp))latest=Math.max(latest,report.timestamp)})
            if(latest<=this.lastReportTimestamp)return
            this.lastReportTimestamp=latest
            this.lastStatsAt=now
            const videoReports=Array.from(stats.values()).filter(r=>r.type==='inbound-rtp'&&r.kind==='video')
            const inbound=videoReports.map(r=>({id:r.id,bytes:r.bytesReceived}))
            const videoTimestamp=videoReports.reduce((latest,r)=>Number.isFinite(r.timestamp)?Math.max(latest,r.timestamp):latest,0)
            const videoFresh=videoTimestamp>this.lastVideoTimestamp
            if(videoFresh){this.lastVideoTimestamp=videoTimestamp;this.lastVideoStatsAt=now}
            this.mediaStalled=this.mediaMonitor.sample(this.lastStatsAt,inbound,this._peerConnection.connectionState==='connected'&&!document.hidden)
            const transport = Array.from(stats.values()).find(report=>report.type==='transport'&&report.selectedCandidatePairId)
            const selectedPair = transport ? stats.get(transport.selectedCandidatePairId) : Array.from(stats.values()).find(report=>report.type==='candidate-pair'&&report.nominated&&report.state==='succeeded')
            this._rtt=0;this._activeRemoteCandidate='';this._remoteHost='';this._remotePort=0;this._remoteIsLocal=false;this._remoteIsIpv6=false
            if(selectedPair?.type==='candidate-pair'){
                this.readCandidatePair(selectedPair)
                const remote=stats.get(selectedPair.remoteCandidateId)
                if(remote?.type==='remote-candidate')this.readRemoteCandidate(remote)
            }
            this._bitrate=0;
            if(!videoFresh){
                this._videoWidth=0;this._videoHeight=0;this._videoFps=0;this._videoCodec='';this._jitter=0;this._packetsLost=0
                return
            }
            this._videoWidth=0;this._videoHeight=0;this._videoFps=0;this._videoCodec='';this._jitter=0;this._packetsLost=0
            stats.forEach((report) => {
                //  @TODO: Implement chat stats using type outbound-rtp

                if(report.type === 'inbound-rtp'){
                    this.readInboundRtp(report)
                    if (report.kind === 'video') {
                        const codec = stats.get(report.codecId)
                        if (codec?.mimeType) this._videoCodec = codec.mimeType
                        const old = this.previous
                        if (old && old.id === report.id && Number.isFinite(report.timestamp) && Number.isFinite(report.bytesReceived) && report.timestamp > old.time && report.bytesReceived >= old.bytes) this._bitrate = (report.bytesReceived - old.bytes) * 8 / (report.timestamp - old.time) / 1000
                        this.previous=Number.isFinite(report.bytesReceived)&&report.bytesReceived>=0&&Number.isFinite(report.timestamp)?{id:report.id,bytes:report.bytesReceived,time:report.timestamp}:undefined
                        this._jitter = (report.jitter || 0) * 1000
                        this._packetsLost = report.packetsLost || 0
                    }

                }
            })

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