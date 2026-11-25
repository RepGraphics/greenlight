import React from 'react'
import { recordingMimeType,startStreamRecording,downloadRecording } from '../../lib/streamrecording'
import { startInstantReplay,replayDuration } from '../../lib/instantreplay'
import { canCapture, captureScreenshotBlob, saveStreamScreenshot, toggleStreamPictureInPicture } from '../../lib/streamcapture'
import { storeCapture } from '../../lib/capturelibrary'
import {sanitizeSample} from '../../lib/streamdiagnostics'
import type {DiagnosticSample} from '../../lib/streamdiagnostics'
import { useSettings } from '../../context/userContext'
import Button from './button'
import Slider from './slider'
import xPlayer from 'xbox-xcloud-player'
import Loader from './loader'
import Card from './card'
import uPlot from 'uplot'
import Ipc from '../../lib/ipc'
import { useTranslation } from 'react-i18next'

interface StreamComponentProps {
    connected?:boolean;
    onCapturePending?:(pending:boolean)=>void;
    onDisconnect?: () => void;
    onLeave?: () => void;
    onMetrics?: (sample:DiagnosticSample)=>void;
    onExportDiagnostics?:()=>void;
    onMenu?: () => void;
    xPlayer: xPlayer;
}

function StreamComponent({
    connected=false,
    onCapturePending,
    onDisconnect,
    onLeave,
    onMetrics,
    onExportDiagnostics,
    onMenu,
    xPlayer,
}: StreamComponentProps) {
    const { t } = useTranslation()
    const { settings } = useSettings()
    const [captureReady,setCaptureReady]=React.useState(false)
    const [captureBusy,setCaptureBusy]=React.useState(false)
    const [captureMessage,setCaptureMessage]=React.useState('')
    const [pipActive,setPipActive]=React.useState(false)
    const captureLock=React.useRef(false)
    const currentClassicVideo=()=>document.querySelector<HTMLVideoElement>('#streamComponentHolder video')
    React.useEffect(()=>{
        const update=()=>{const video=currentClassicVideo();setCaptureReady(Boolean(settings.video_enabled&&canCapture(video)));setPipActive(Boolean(video&&document.pictureInPictureElement===video))}
        update();const timer=setInterval(update,500)
        return()=>{clearInterval(timer);const video=currentClassicVideo();if(video&&document.pictureInPictureElement===video)void document.exitPictureInPicture().catch(()=>{})}
    },[xPlayer,settings.video_enabled])
    const capture=async(action:'download'|'library'|'pip')=>{
        if(captureLock.current)return
        const video=currentClassicVideo()
        if(!settings.video_enabled||!canCapture(video))return
        captureLock.current=true;setCaptureBusy(true);setCaptureMessage('')
        try{
            if(action==='download'){await saveStreamScreenshot(video);setCaptureMessage('classicScreenshotSaved')}
            else if(action==='library'){await storeCapture('screenshot',await captureScreenshotBlob(video));setCaptureMessage('captureLibrarySaved')}
            else {await toggleStreamPictureInPicture(video);setPipActive(document.pictureInPictureElement===video)}
        }catch{setCaptureMessage(action==='pip'?'classicPipFailed':'classicScreenshotFailed')}finally{captureLock.current=false;setCaptureBusy(false)}
    }
    const recording=React.useRef<ReturnType<typeof startStreamRecording>|null>(null)
    const replay=React.useRef<ReturnType<typeof startInstantReplay>|null>(null)
    const mounted=React.useRef(false)
    const saving=React.useRef(false)
    const [recordingActive,setRecordingActive]=React.useState(false)
    const [replayActive,setReplayActive]=React.useState(false)
    const [replayReady,setReplayReady]=React.useState(false)
    const [clip,setClip]=React.useState<Blob|null>(null)
    const [clipBusy,setClipBusy]=React.useState(false)
    const protectedCapture=recordingActive||Boolean(clip)||clipBusy
    React.useEffect(()=>{onCapturePending?.(protectedCapture)},[onCapturePending,protectedCapture])
    React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;recording.current?.stop();replay.current?.dispose()}},[])
    React.useEffect(()=>{if(!connected||!settings.video_enabled){recording.current?.stop();replay.current?.dispose();replay.current=null;setReplayActive(false);setReplayReady(false)}},[connected,settings.video_enabled])
    React.useEffect(()=>{if(!protectedCapture)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[protectedCapture])
    const currentClassicAudio=()=>document.querySelector<HTMLAudioElement>('#streamComponentHolder audio')
    const toggleRecording=()=>{
        if(recording.current){recording.current.stop();return}
        if(replay.current||saving.current||clip||!connected)return
        const video=currentClassicVideo();if(!settings.video_enabled||!canCapture(video)||!recordingMimeType())return
        try{recording.current=startStreamRecording(video,(blob,error)=>{recording.current=null;if(!mounted.current)return;setRecordingActive(false);setClip(blob);setCaptureMessage(error?'recordingFailed':'recordingStopped')},currentClassicAudio());setRecordingActive(true)}catch{setCaptureMessage('recordingFailed')}
    }
    const toggleReplay=()=>{
        if(saving.current)return
        if(replay.current){replay.current.dispose();replay.current=null;setReplayActive(false);setReplayReady(false);return}
        const video=currentClassicVideo();if(recording.current||clip||!connected||!settings.video_enabled||!canCapture(video)||!recordingMimeType())return
        try{replay.current=startInstantReplay(video,ready=>{if(mounted.current)setReplayReady(ready)},()=>{replay.current=null;if(mounted.current){setReplayActive(false);setReplayReady(false);setCaptureMessage('replayFailed')}},settings.v3_replay_seconds,currentClassicAudio());setReplayActive(true)}catch{setCaptureMessage('replayFailed')}
    }
    const saveReplay=async()=>{
        if(!replay.current||saving.current||clip)return
        saving.current=true;setClipBusy(true)
        try{const blob=await replay.current.save();if(mounted.current){setClip(blob);setCaptureMessage(blob?'replaySaved':'replayFailed')}}catch{if(mounted.current)setCaptureMessage('replayFailed')}finally{saving.current=false;if(mounted.current)setClipBusy(false)}
    }
    const saveClip=async()=>{if(!clip||saving.current)return;saving.current=true;setClipBusy(true);try{await storeCapture('clip',clip);if(mounted.current){setClip(null);setCaptureMessage('captureLibrarySaved')}}catch{if(mounted.current)setCaptureMessage('captureLibraryFailed')}finally{saving.current=false;if(mounted.current)setClipBusy(false)}}
    const canLeave=()=>{if(recording.current||saving.current||clip){setCaptureMessage('saveClipBeforeExit');return false}return true}
    const [hud, setHud] = React.useState(settings.stream_performance_hud)
    const [metrics, setMetrics] = React.useState<{ fps?: number; width?: number; height?: number; jitter?: number; loss?: number; bitrate?: number }>({})
    React.useEffect(() => {
        if (!hud&&!onMetrics) return
        let disposed = false, busy = false
        let previous: { bytes: number; time: number; id:string } | undefined
        const sample = async () => {
            if (busy || disposed || !xPlayer._webrtcClient) return
            busy = true
            try {
                const stats = await xPlayer._webrtcClient.getStats()
                if (disposed) return
                let rtt=0
                stats.forEach(report=>{if(report.type==='transport'&&report.selectedCandidatePairId){const pair=stats.get(report.selectedCandidatePairId);if(typeof pair?.currentRoundTripTime==='number')rtt=pair.currentRoundTripTime*1000}})
                stats.forEach(report => {
                    if (report.type !== 'inbound-rtp' || report.kind !== 'video') return
                    const bytes = report.bytesReceived, time = report.timestamp
                    const bitrate = previous && previous.id===report.id && time > previous.time && bytes >= previous.bytes ? (bytes - previous.bytes) * 8 / (time - previous.time) / 1000 : undefined
                    if (typeof bytes === 'number' && typeof time === 'number') previous = { bytes, time, id:report.id }
                    onMetrics?.(sanitizeSample({fps:report.framesPerSecond??0,width:report.frameWidth??0,height:report.frameHeight??0,jitter:typeof report.jitter==='number'?report.jitter*1000:0,loss:report.packetsLost??0,bitrate:bitrate??0,rtt,statsFresh:bitrate!==undefined,peerState:xPlayer._webrtcClient.connectionState,iceState:xPlayer._webrtcClient.iceConnectionState,signalingState:xPlayer._webrtcClient.signalingState},0))
                    if(hud)setMetrics({ fps: report.framesPerSecond, width: report.frameWidth, height: report.frameHeight, jitter: typeof report.jitter === 'number' ? report.jitter * 1000 : undefined, loss: report.packetsLost, bitrate })
                })
            } catch { /* stats may be unavailable during disconnect */ } finally { busy = false }
        }
        void sample()
        const interval = setInterval(sample, 1000)
        return () => { disposed = true; clearInterval(interval) }
    }, [hud, xPlayer,onMetrics])

    const refreshVideo = React.useCallback(()=>{
        const video=document.querySelector<HTMLVideoElement>('#streamComponentHolder video')
        if(video && settings.video_enabled) void video.play().catch(()=>{})
    },[settings.video_enabled])
    React.useEffect(()=>{
        if(!settings.video_enabled)return
        let lastTime=-1,stalled=0
        const timer=setInterval(()=>{
            if(document.hidden){stalled=0;return}
            const video=document.querySelector<HTMLVideoElement>('#streamComponentHolder video')
            if(!video||!video.srcObject){stalled=0;lastTime=-1;return}
            if(video.currentTime===lastTime||video.paused)stalled++;else stalled=0
            lastTime=video.currentTime
            if(stalled>=3){refreshVideo();stalled=0}
        },2000)
        return()=>clearInterval(timer)
    },[xPlayer,refreshVideo,settings.video_enabled])

    function performance_now_seconds() {
        return performance.now() / 1000.0
    }

    let lastMovement = Date.now()
    const pinned = React.useRef(false)
    const [controlsPinned, setControlsPinned] = React.useState(false)
    const [fullscreen, setFullscreen] = React.useState(false)
    const togglePin = () => { pinned.current = !pinned.current; setControlsPinned(pinned.current) }
    const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen() } catch { /* unavailable */ } }
    React.useEffect(() => { const sync = () => setFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', sync); return () => document.removeEventListener('fullscreenchange', sync) }, [])
    // let gamebarElement = document.getElementById('component_streamcomponent_gamebar')
    let debugElement = document.getElementById('component_streamcomponent_debug')
    let webRtcStatsInterval

    const [micStatus, setMicStatus] = React.useState(false)
    const [waitingSeconds, setWaitingSeconds] = React.useState(0)



    //Client-side volume control
    const [volume, setVolume] = React.useState(1.0) //without any controls, the volume has been maxed by default, let's follow this assumption and start at full for our slider
    const handleVolumeChange = (newVolume: number) => {

        const audioElement = document.getElementsByTagName('audio')[0]

        if(audioElement) {
            setVolume(newVolume)
            audioElement.volume = newVolume
        } else {
            console.error('VolumeSlider: handleChange: failed to find current or lost previous audioelement. Current element:', audioElement)
        }

    }
    const volumeIcon = ( //from https://www.svgrepo.com/svg/502904/volume-low and optimized w/ https://jakearchibald.github.io/svgomg/
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 14v-4a1 1 0 0 1 1-1h2.65a1 1 0 0 0 .624-.22l3.101-2.48A1 1 0 0 1 16 7.08v9.84a1 1 0 0 1-1.625.78l-3.101-2.48a1 1 0 0 0-.625-.22H8a1 1 0 0 1-1-1Z" /></svg>
    )


    let jitterData = [new Float32Array([performance_now_seconds()]), new Float32Array([0.0])]
    let droppedData = [new Float32Array([performance_now_seconds()]), new Float32Array([0.0]), new Float32Array([0.0])]
    let framesDroppedBaseline = 0
    let packetsDroppedBaseline = 0
    let frameCountDomUpdate = 0


    function sliceData(data, start, end) {
        const d = []

        for (let i = 0; i < data.length; i++)
            d.push(data[i].slice(start, end))

        return d
    }

    React.useEffect(() => {

        const queueListener = Ipc.onAction('streaming', 'onQueue', (event, waitingTimes) => {
            console.log('Waiting times:', waitingTimes)
            drawWaitingTimes(waitingTimes?.estimatedTotalWaitTimeInSeconds)
        })

        // ipcRenderer.on('xcloud', (event, args) => {
        //   console.log('GOT EVENT:', event, args)

        //   if(args.type === 'waitingtimes'){
        //     // Render countdown
        //     console.log('Seconds waiting time:', args.data.estimatedTotalWaitTimeInSeconds)
        //     // setWaitingTimes(args.data)
        //     drawWaitingTimes(args.data.estimatedTotalWaitTimeInSeconds)
        //   }
        // })

        const jitterUplot = new uPlot({
            title: 'Jitter (ms)',
            id: 'component_streamcomponent_debug_webrtc_jitter',
            class: 'debug-chart',
            width: 600,
            height: 230,
            scales: {
                'x': {
                    time: false,
                },
            },
            series: [
                {},
                {
                    show: true,
                    spanGaps: false,
                    label: 'Jitter',
                    stroke: 'red',
                    width: 2,
                    fill: 'rgba(255, 0, 0, 0.3)',
                },
            ],
            axes: [
                {
                    values: (u, vals) => vals.map(v => +v),
                },
                {
                    size: 50,
                    stroke: 'red',
                    values: (u, vals) => vals.map(v => (+v * 1000.0).toFixed(1)),
                },
            ],
        }, jitterData, document.getElementById('component_streamcomponent_debug_webrtc_jitter'))

        const droppedUplot = new uPlot({
            title: 'Packets lost / Frames dropped',
            id: 'component_streamcomponent_debug_webrtc_dropped',
            class: 'debug-chart',
            width: 600,
            height: 230,
            scales: {
                'x': {
                    time: false,
                },
            },
            series: [
                {},
                {
                    show: true,
                    spanGaps: false,
                    label: 'Packets lost',
                    stroke: 'green',
                    width: 2,
                    fill: 'rgba(0, 255, 0, 0.3)',
                },
                {
                    show: true,
                    spanGaps: false,
                    label: 'Frames dropped',
                    stroke: 'blue',
                    width: 2,
                    fill: 'rgba(0, 0, 255, 0.3)',
                },
            ],
            axes: [
                {
                    values: (u, vals) => vals.map(v => +v),
                },
                {
                    size: 50,
                    stroke: 'green',
                    values: (u, vals) => vals.map(v => +v.toFixed(0)),
                    grid: { show: false },
                },
                {
                    side: 1,
                    stroke: 'blue',
                    values: (u, vals) => vals.map(v => +v.toFixed(0)),
                    grid: { show: false },
                },
            ],
        }, droppedData, document.getElementById('component_streamcomponent_debug_webrtc_dropped'))

        let disposed = false
        let statsPending = false
        webRtcStatsInterval = setInterval(() => {
            if (!disposed && !statsPending && document.getElementById('component_streamcomponent_debug')?.classList.contains('hidden') === false && xPlayer._webrtcClient !== undefined) {
                statsPending = true
                xPlayer._webrtcClient.getStats().then((stats) => {
                    if (disposed) return
                    let statsOutput = ''

                    stats.forEach((report) => {
                        if (report.type === 'inbound-rtp' && report.kind === 'video') {

                            if (jitterData[0].length > 1200) {
                                jitterData = sliceData(jitterData, jitterData[0].length - 1200, jitterData[0].length)
                            }
                            if (droppedData[0].length > 1200) {
                                droppedData = sliceData(droppedData, droppedData[0].length - 1200, droppedData[0].length)
                            }

                            jitterData[0] = new Float32Array([...Array.from(jitterData[0]), performance_now_seconds()])
                            jitterData[1] = new Float32Array([...Array.from(jitterData[1]), report['jitter']])

                            droppedData[0] = new Float32Array([...Array.from(droppedData[0]), performance_now_seconds()])
                            droppedData[1] = new Float32Array([...Array.from(droppedData[1]), report['packetsLost'] - packetsDroppedBaseline])
                            droppedData[2] = new Float32Array([...Array.from(droppedData[2]), report['framesDropped'] - framesDroppedBaseline])
                            packetsDroppedBaseline = report['packetsLost']
                            framesDroppedBaseline = report['framesDropped']

                            jitterUplot.setData(jitterData)
                            droppedUplot.setData(droppedData)

                            if (frameCountDomUpdate >= 15) {
                                Object.keys(report).forEach((statName) => {
                                    statsOutput += statName + ': ' + report[statName] + '\n'
                                })
                                document.querySelector('div#component_streamcomponent_debug_text').textContent = statsOutput
                                frameCountDomUpdate = 0
                            } else {
                                frameCountDomUpdate++
                            }
                        }
                    })

                }).catch(() => {}).finally(() => { statsPending = false })
            }
        }, 250)

        // Gamebar menu mouse events
        const mouseEvent = () => {
            lastMovement = Date.now()
        }
        window.addEventListener('mousemove', mouseEvent)
        window.addEventListener('mousedown', mouseEvent)

        const mouseInterval = setInterval(() => {
            const gamebarElement = document.getElementById('component_streamcomponent_gamebar')
            if (gamebarElement === null) {
                return
            }

            if (!pinned.current && !gamebarElement.contains(document.activeElement) && (Date.now() - lastMovement) >= 2000) {
                if (!gamebarElement.className.includes('hidden')) {
                    gamebarElement.className = 'hidden'
                }

            } else {
                if (gamebarElement.className.includes('hidden')) {
                    gamebarElement.className = ''
                }
            }
        }, 100)

        // Keyboard events
        const keyboardPressEvent = (e) => {
            if (e.key === 'F8') { e.preventDefault(); pinned.current = !pinned.current; setControlsPinned(pinned.current); return }
            switch (e.keyCode) {
                case 126:
                    toggleDebug()
                    break
            }
        }
        window.addEventListener('keydown', keyboardPressEvent)

        // cleanup this component
        return () => {
            disposed = true
            if (queueListener) Ipc.removeListener('streaming', queueListener)
            jitterUplot.destroy()
            droppedUplot.destroy()
            window.removeEventListener('mousemove', mouseEvent)
            window.removeEventListener('mousedown', mouseEvent)
            window.removeEventListener('keydown', keyboardPressEvent)
            clearInterval(mouseInterval)

            // ipcRenderer.removeAllListeners('xcloud');

            if (webRtcStatsInterval) {
                clearInterval(webRtcStatsInterval)
            }
            (document.getElementById('component_streamcomponent_debug_webrtc_jitter') !== null) ? document.getElementById('component_streamcomponent_debug_webrtc_jitter').innerHTML = '' : false;
            (document.getElementById('component_streamcomponent_debug_webrtc_dropped') !== null) ? document.getElementById('component_streamcomponent_debug_webrtc_dropped').innerHTML = '' : false
        }
    }, [])



    function toggleMic() {
        if (xPlayer.getChannelProcessor('chat').isPaused === true) {
            xPlayer.getChannelProcessor('chat').startMic()
            setMicStatus(true)
        } else {
            xPlayer.getChannelProcessor('chat').stopMic()
            setMicStatus(false)
        }
    }

    function streamDisconnect() {
        if(!canLeave())return
        onLeave?.()
        document.getElementById('streamComponentHolder').innerHTML = ''

        xPlayer.close()
    }

    function endStream() {
        if(!canLeave())return
        if (confirm(t("streamWindow.endStreamConfirmMessage"))) {
            document.getElementById('streamComponentHolder').innerHTML = ''
            onDisconnect()
            xPlayer.close()
        }
    }

    function toggleDebug() {
        if (debugElement === null) {
            debugElement = document.getElementById('component_streamcomponent_debug')
        }

        if (debugElement.className.includes('hidden')) {
            debugElement.className = ''
        } else {
            debugElement.className = 'hidden'
        }
    }

    function drawWaitingTimes(seconds) {
        if (typeof seconds === 'number' && Number.isFinite(seconds)) setWaitingSeconds(Math.max(0, seconds))
    }

    React.useEffect(() => {
        if (waitingSeconds <= 0) return
        const timeout = setTimeout(() => setWaitingSeconds(seconds => Math.max(0, seconds - 1)), 1000)
        return () => clearTimeout(timeout)
    }, [waitingSeconds])

    function formatWaitingTime(rawSeconds: number): string {
        let formattedText = ''

        const hours = Math.floor(rawSeconds / 3600)
        const minutes = Math.floor((rawSeconds % 3600) / 60)
        const seconds = (rawSeconds % 3600) % 60

        if (hours > 0) {
            formattedText += hours + ' ' + t("streamWindow.timeHours") + ', '
        }

        if (minutes > 0) {
            formattedText += minutes + ' ' + t("streamWindow.timeMinutes") + ', '
        }

        if (seconds > 0) {
            formattedText += seconds + ' ' + t("streamWindow.timeSeconds") + '.'
        }

        return formattedText
    }

    return (
        <React.Fragment>
            <div>
                {hud && <div className='gl-performance-hud' aria-label={t('dashboard.performanceHud')}><span>{metrics.width && metrics.height ? metrics.width + '×' + metrics.height : '—'}</span><span>{metrics.fps != null ? Math.round(metrics.fps) : '—'} FPS</span><span>{metrics.bitrate != null ? metrics.bitrate.toFixed(1) : '—'} Mbps</span><span>{metrics.jitter != null ? metrics.jitter.toFixed(1) : '—'} ms {t('dashboard.jitter')}</span><span>{metrics.loss ?? '—'} {t('dashboard.packetsLost')}</span></div>}
                {captureMessage&&<div className='gl-recording-result' role='status'>{t('dashboard.'+captureMessage)} <button type='button' className='btn' onClick={()=>setCaptureMessage('')}>{t('dashboard.dismiss')}</button></div>}
                {recordingActive&&<div className='gl-recording-indicator' role='status'><span/>REC</div>}
                {replayActive&&<div className='gl-replay-indicator' role='status'>{t(replayReady?'dashboard.replayReady':'dashboard.replayBuffering',{seconds:replayDuration(settings.v3_replay_seconds)})}</div>}
                {clip&&<div className='gl-recording-result'><strong>{t('dashboard.clipReady')}</strong> · {(clip.size/1048576).toFixed(2)} MiB <button type='button' className='btn' disabled={clipBusy} onClick={()=>{downloadRecording(clip);setClip(null)}}>{t('dashboard.saveClip')}</button><button type='button' className='btn' disabled={clipBusy} onClick={()=>void saveClip()}>{t('dashboard.saveToLibrary')}</button><button type='button' className='btn' disabled={clipBusy} onClick={()=>setClip(null)}>{t('dashboard.discardClip')}</button></div>}
                <div id="streamComponentHolder">
                </div>

                <div id="component_streamcomponent_loader">
                    <Card className='padbottom'>
                        <h1>{t("streamWindow.loadingStreamTitle")}</h1>

                        <Loader></Loader>

                        <p>{t("streamWindow.gettingStreamReadyMessage")}</p>
                        <p id="component_streamcomponent_connectionstatus"></p>

                        <p id="component_streamcomponent_waitingtimes">{waitingSeconds > 0 ? t("streamWindow.estimatedWaitingTimeMessage") + " " + formatWaitingTime(waitingSeconds) : ""}</p>
                    </Card>
                </div>

                <div id="component_streamcomponent_gamebar">
                    <div id="component_streamcomponent_gamebar_menu">
                        <div style={{
                            width: '25%',
                        }}>
                            <Button label={<span><i className="fa-solid fa-xmark"></i> {t("streamWindow.endStreamBtn")}</span>} title={t("streamWindow.endStreamBtn")} className='btn-cancel' onClick={() => {
                                endStream()
                            }}></Button> &nbsp;
                            <Button label={<span><i className="fa-solid fa-xmark"></i></span>} title={t("streamWindow.disconnectBtn")} className='btn' onClick={() => {
                                streamDisconnect()
                            }}></Button>
                        </div>

                        <div style={{
                            marginLeft: 'auto',
                            marginRight: 'auto',
                        }}>
                            <Button disabled={!onMenu} label={<span><i className="fa-brands fa-xbox"></i> {t("streamWindow.menuBtn")}</span>} title={t("streamWindow.menuTitle")} onClick={(e) => {
                                e.target.blur(); onMenu?.()
                            }}></Button> &nbsp;
                            <Button label={(micStatus === false) ? <span><i className="fa-solid fa-microphone-slash"></i> {t("streamWindow.micMuted")}</span> : <span><i className="fa-solid fa-microphone"></i> {t("streamWindow.micActive")}</span>} title={(micStatus === false) ? t("streamWindow.enableMic") : t("streamWindow.disableMic")} className={(micStatus === false) ? 'btn-cancel' : 'btn-primary'} onClick={(e) => {
                                e.target.blur(); toggleMic()
                            }}></Button>
                        </div>

                        <Slider
                            id="volume-slider"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volume}
                            onChange={handleVolumeChange}
                            label="Volume"
                            svg={volumeIcon}
                        />

                        <div className='gl-stream-extra' style={{
                            marginRight: 20,
                            width: '25%',
                            textAlign: 'right',
                        }}>
                            <button type='button' className='btn' title={t('dashboard.refreshVideo')} onClick={refreshVideo}><i className='fa-solid fa-rotate' aria-hidden='true'/></button>{onExportDiagnostics&&<button type='button' className='btn' title={t('dashboard.exportDiagnostics')} aria-label={t('dashboard.exportDiagnostics')} onClick={onExportDiagnostics}><i className='fa-solid fa-file-arrow-down' aria-hidden='true'/></button>}<button type='button' className='btn' aria-label={t('dashboard.performanceHud')} aria-pressed={hud} onClick={() => setHud(value => !value)}><i className='fa-solid fa-chart-line' aria-hidden='true' /></button>
                            <button type='button' className='btn' disabled={!captureReady||captureBusy} title={t('dashboard.screenshot')} aria-label={t('dashboard.screenshot')} onClick={()=>void capture('download')}><i className='fa-solid fa-camera' aria-hidden='true'/></button>
                            <button type='button' className='btn' disabled={!captureReady||captureBusy} title={t('dashboard.saveToLibrary')} aria-label={t('dashboard.saveToLibrary')} onClick={()=>void capture('library')}><i className='fa-solid fa-floppy-disk' aria-hidden='true'/></button>
                            <button type='button' className='btn' disabled={!captureReady||captureBusy} aria-pressed={pipActive} title={t('dashboard.classicPip')} aria-label={t('dashboard.classicPip')} onClick={()=>void capture('pip')}><i className='fa-solid fa-window-restore' aria-hidden='true'/></button>
                            <button type='button' className='btn' disabled={!recordingActive&&(!connected||!captureReady||replayActive||Boolean(clip)||clipBusy)} aria-pressed={recordingActive} title={t(recordingActive?'dashboard.stopRecording':'dashboard.startRecording')} aria-label={t(recordingActive?'dashboard.stopRecording':'dashboard.startRecording')} onClick={toggleRecording}><i className={'fa-solid '+(recordingActive?'fa-stop':'fa-circle')} aria-hidden='true'/></button>
                            <button type='button' className='btn' disabled={clipBusy||(!replayActive&&(!connected||!captureReady||recordingActive||Boolean(clip)))} aria-pressed={replayActive} title={t('dashboard.instantReplay')} aria-label={t('dashboard.instantReplay')} onClick={toggleReplay}><i className='fa-solid fa-clock-rotate-left' aria-hidden='true'/></button>
                            {replayActive&&<button type='button' className='btn' disabled={clipBusy||Boolean(clip)} title={t('dashboard.saveReplay')} aria-label={t('dashboard.saveReplay')} onClick={()=>void saveReplay()}><i className='fa-solid fa-film' aria-hidden='true'/></button>}
                            <button type='button' className='btn' aria-pressed={controlsPinned} title={t('dashboard.pinControls')} onClick={togglePin}><i className='fa-solid fa-thumbtack' aria-hidden='true' /></button>
                            <button type='button' className='btn' aria-label={t('dashboard.fullscreen')} aria-pressed={fullscreen} onClick={() => { void toggleFullscreen() }}><i className={'fa-solid ' + (fullscreen ? 'fa-compress' : 'fa-expand')} aria-hidden='true' /></button>
                            <Button label={<i className="fa-solid fa-bug"></i>} title={t("streamWindow.debugTitle")} onClick={(e) => {
                                e.target.blur(); toggleDebug()
                            }}></Button>
                        </div>
                    </div>
                </div>

                <div id="component_streamcomponent_debug" className='hidden'>
                    <p>{t("streamWindow.debugTitle")}:</p>

                    <div id="component_streamcomponent_debug_webrtc_jitter"></div>
                    <div id="component_streamcomponent_debug_webrtc_dropped"></div>

                    <div id="component_streamcomponent_debug_text"></div>
                </div>
            </div>
        </React.Fragment>
    )
}

export default StreamComponent
