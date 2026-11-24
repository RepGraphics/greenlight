import React from 'react'
import { startStreamRecording, recordingMimeType, downloadRecording } from '../../lib/streamrecording'
import { currentVideo, canCapture, saveStreamScreenshot, toggleStreamPictureInPicture } from '../../lib/streamcapture'
import NetworkGraphs from './networkgraphs'
import { recommendLowerBitrate } from '../../lib/bitrateadvisor'
import VideoFilterControls from './videofiltercontrols'
import { validateVideoFilters, videoFilterCss, sharpeningKernel } from '../../lib/videofilters'
import { addSession, makeSessionRecord } from '../../lib/sessionhistory'
import { readConsoleProfiles } from '../../lib/consoleprofiles'
import { readGameProfiles } from '../../lib/gameprofiles'
import { readProfiles } from '../../lib/controllerprofiles'
import { downloadDiagnostics, sanitizeSample, summarizeDiagnostics } from '../../lib/streamdiagnostics'
import type { DiagnosticSample } from '../../lib/streamdiagnostics'
import type { StreamMetrics } from '../../../../player/src/client/index'
import dynamic from 'next/dynamic'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { useTranslation } from 'react-i18next'

const SharedPlayer = dynamic(() => import('../../../../player/src/client/index').then(module => module.StreamPlayer), { ssr: false })

export default function ExperimentalStream({ target, onExit }: { target: string; onExit: () => void }) {
    const { settings: globalSettings, setSettings } = useSettings()
    const [settings] = React.useState(() => {
        const cloud = target.startsWith('xcloud_')
        const game = cloud ? readGameProfiles(globalSettings.v3_game_profiles).find(item => item.titleId === target.slice(7)) : readConsoleProfiles(globalSettings.console_profiles).find(item => item.consoleId === target)
        const profile = game?.controllerProfile ? readProfiles(globalSettings.v3_controller_profiles).find(item => item.name === game.controllerProfile) : undefined
        return {...globalSettings, ...(profile || {}), xcloud_bitrate:cloud ? game?.bitrate ?? globalSettings.xcloud_bitrate : globalSettings.xcloud_bitrate, xhome_bitrate:!cloud ? game?.bitrate ?? globalSettings.xhome_bitrate : globalSettings.xhome_bitrate, v3_renderer:game && game.renderer !== 'default' ? game.renderer : globalSettings.v3_renderer}
    })
    const { t } = useTranslation()
    const [summary, setSummary] = React.useState<ReturnType<typeof summarizeDiagnostics> | null>(null)
    const [showSummary, setShowSummary] = React.useState(false)
    const [showGraphs,setShowGraphs] = React.useState(false)
    const [graphSamples,setGraphSamples] = React.useState<DiagnosticSample[]>([])
    const graphVisible=React.useRef(false)
    graphVisible.current=showGraphs
    const samples = React.useRef<DiagnosticSample[]>([])
    const started = React.useRef(0)
    const connectedAt = React.useRef(0)
    const outcome = React.useRef<'ended'|'failed'|'interrupted'>('interrupted')
    const lastState = React.useRef('Initializing')
    const sampleCount = React.useRef(0)
    const recordMetrics = React.useCallback((metrics: StreamMetrics) => {
        samples.current.push(sanitizeSample(metrics, (Date.now() - started.current) / 1000))
        if (samples.current.length > 300) samples.current.shift()
        if(graphVisible.current) setGraphSamples([...samples.current])
        if (++sampleCount.current % 5 === 0) setSummary(summarizeDiagnostics(samples.current))
    }, [])
    const [attempt, setAttempt] = React.useState(0)
    const [bitrateOverride,setBitrateOverride] = React.useState<number|null>(null)
    const [restartCap,setRestartCap] = React.useState<number|null>(null)
    const activeCap = bitrateOverride ?? (target.startsWith('xcloud_')?settings.xcloud_bitrate:settings.xhome_bitrate)
    const recommendedCap = summary ? recommendLowerBitrate(samples.current,activeCap) : null
    const [session, setSession] = React.useState('')
    const [state, setState] = React.useState('Initializing')
    const updateStatus = React.useCallback((value: string) => {
        lastState.current = value
        if (value === 'Connected' && !connectedAt.current) connectedAt.current = Date.now()
        if (value === 'Error') outcome.current = 'failed'
        setState(value)
    }, [])
    const endStream = () => { if(recording.current){recording.current.stop();setConfirmEnd(false);return} if(recordedClip){setConfirmEnd(false);setCaptureMessage('saveClipBeforeExit');return} outcome.current = 'ended'; onExit() }
    const [filters,setFilters] = React.useState(()=>validateVideoFilters(settings.v3_video_filters))
    const [showFilters,setShowFilters] = React.useState(false)
    const [controlsVisible,setControlsVisible] = React.useState(true)
    const [controlsPinned,setControlsPinned] = React.useState(false)
    const [confirmEnd,setConfirmEnd] = React.useState(false)
    const [fullscreen,setFullscreen] = React.useState(false)
    const toolbar = React.useRef<HTMLDivElement>(null)
    const [toolbarFocused,setToolbarFocused] = React.useState(false)
    const [toolbarHovered,setToolbarHovered] = React.useState(false)
    React.useEffect(()=>{
        let timer: ReturnType<typeof setTimeout>
        const reveal=()=>{setControlsVisible(true);clearTimeout(timer);if(state==='Connected'&&!controlsPinned&&!showFilters&&!confirmEnd&&restartCap===null&&!toolbarFocused&&!toolbarHovered)timer=setTimeout(()=>setControlsVisible(false),3500)}
        const key=(event:KeyboardEvent)=>{if(event.key==='F8'){event.preventDefault();setControlsPinned(value=>!value);reveal()}else if(event.key==='Escape'){setShowFilters(false);setShowGraphs(false);setConfirmEnd(false);setRestartCap(null);reveal()}else if(event.key==='Tab')reveal()}
        const syncFullscreen=()=>setFullscreen(Boolean(document.fullscreenElement))
        window.addEventListener('pointermove',reveal);window.addEventListener('pointerdown',reveal);window.addEventListener('keydown',key);document.addEventListener('fullscreenchange',syncFullscreen);syncFullscreen();reveal()
        return()=>{clearTimeout(timer);window.removeEventListener('pointermove',reveal);window.removeEventListener('pointerdown',reveal);window.removeEventListener('keydown',key);document.removeEventListener('fullscreenchange',syncFullscreen)}
    },[state,controlsPinned,showFilters,confirmEnd,restartCap,toolbarFocused,toolbarHovered])
    const toggleFullscreen=()=>{const request=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();void request.catch(()=>{})}
    const retryStream=()=>{setConfirmEnd(false);setShowFilters(false);setAttempt(value=>value+1)}
    const restartWithCap=()=>{if(restartCap===null)return;setBitrateOverride(restartCap);setRestartCap(null);retryStream()}
    const [displayMode,setDisplayMode] = React.useState(settings.video_size)
    const [captureAvailable,setCaptureAvailable] = React.useState(false)
    const [pipAvailable,setPipAvailable] = React.useState(false)
    const [pipActive,setPipActive] = React.useState(false)
    const recording=React.useRef<ReturnType<typeof startStreamRecording>|null>(null)
    const [recordingActive,setRecordingActive]=React.useState(false)
    const [recordingElapsed,setRecordingElapsed]=React.useState(0)
    const [recordingAvailable,setRecordingAvailable]=React.useState(false)
    const [recordedClip,setRecordedClip]=React.useState<Blob|null>(null)
    const mounted=React.useRef(true)
    React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;recording.current?.stop()}},[])
    React.useEffect(()=>{if(state!=='Connected')recording.current?.stop()},[state,session])
    React.useEffect(()=>{setRecordingAvailable(captureAvailable&&Boolean(recordingMimeType()))},[captureAvailable])
    React.useEffect(()=>{if(!recordingActive)return;const timer=setInterval(()=>setRecordingElapsed(Math.floor((Date.now()-(recording.current?.startedAt??Date.now()))/1000)),1000);return()=>clearInterval(timer)},[recordingActive])
    const toggleRecording=()=>{if(recording.current){recording.current.stop();return}const video=currentVideo();if(!canCapture(video)||!recordingAvailable||recordedClip)return;try{recording.current=startStreamRecording(video,(blob,error)=>{recording.current=null;if(!mounted.current)return;setRecordingActive(false);setRecordedClip(blob);setCaptureMessage(error?'recordingFailed':'recordingStopped')});setRecordingElapsed(0);setRecordingActive(true)}catch{setCaptureMessage('recordingFailed')}}
    const [captureBusy,setCaptureBusy] = React.useState(false)
    const [captureMessage,setCaptureMessage] = React.useState('')
    React.useEffect(()=>{
        if(state!=='Connected'||!settings.video_enabled){setCaptureAvailable(false);setPipAvailable(false);setPipActive(false);return}
        let surface:HTMLVideoElement|null=null
        const update=()=>{const video=currentVideo();if(video!==surface){surface?.removeEventListener('enterpictureinpicture',update);surface?.removeEventListener('leavepictureinpicture',update);surface=video;surface?.addEventListener('enterpictureinpicture',update);surface?.addEventListener('leavepictureinpicture',update)}const ready=canCapture(video);setCaptureAvailable(ready);setPipAvailable(ready&&Boolean(document.pictureInPictureEnabled)&&typeof video.requestPictureInPicture==='function');setPipActive(Boolean(video&&document.pictureInPictureElement===video))}
        update();const timer=setInterval(update,1000)
        return()=>{clearInterval(timer);surface?.removeEventListener('enterpictureinpicture',update);surface?.removeEventListener('leavepictureinpicture',update);if(surface&&document.pictureInPictureElement===surface)void document.exitPictureInPicture().catch(()=>{})}
    },[state,session,settings.video_enabled])
    React.useEffect(()=>{if(!captureMessage)return;const timer=setTimeout(()=>setCaptureMessage(''),4000);return()=>clearTimeout(timer)},[captureMessage])
    const captureFrame=async()=>{if(captureBusy||state!=='Connected'||!settings.video_enabled)return;setCaptureBusy(true);try{await saveStreamScreenshot(currentVideo());setCaptureMessage('screenshotReady')}catch{setCaptureMessage('screenshotFailed')}finally{setCaptureBusy(false)}}
    const togglePip=async()=>{if(state!=='Connected'||!settings.video_enabled)return;try{await toggleStreamPictureInPicture(currentVideo())}catch{setCaptureMessage('pipFailed')}}
    const [keyframeRequest,setKeyframeRequest] = React.useState(0)
    const [lastRefresh,setLastRefresh] = React.useState(0)
    const [hud, setHud] = React.useState(Boolean(settings.stream_performance_hud))
    const [volume, setVolume] = React.useState(1)
    const [mic, setMic] = React.useState(false)
    const [micBusy, setMicBusy] = React.useState(false)
    const [micActive, setMicActive] = React.useState(false)
    const [micError, setMicError] = React.useState(false)
    const [touch, setTouch] = React.useState(Boolean(settings.input_touch))
    const [muted, setMuted] = React.useState(!settings.audio_enabled)
    const cloud = target.startsWith('xcloud_')
    const id = cloud ? target.slice(7) : target
    const [consoleController,setConsoleController] = React.useState(!cloud && settings.v3_console_controller)
    React.useEffect(() => {
        let disposed = false
        let active = ''
        samples.current = []; sampleCount.current = 0; started.current = Date.now(); connectedAt.current = 0; outcome.current = 'interrupted'; lastState.current = 'Initializing'; setSummary(null); setGraphSamples([])
        setSession(''); setState('Initializing'); setMic(false); setMicBusy(false); setMicActive(false); setMicError(false)
        Ipc.send('streaming', 'startStream', { type: cloud ? 'cloud' : 'home', target: id }).then((result: string) => {
            if (disposed) { void Ipc.send('streaming', 'stopStream', { sessionId: result }).catch(() => {}); return }
            active = result; setSession(result)
        }).catch(() => { if (!disposed) updateStatus('Error') })
        return () => { disposed = true; if (settings.v3_session_history && (connectedAt.current || lastState.current === 'Error')) addSession(makeSessionRecord(started.current,connectedAt.current,Date.now(),cloud?'cloud':'home',outcome.current,samples.current)); if (active) void Ipc.send('streaming', 'stopStream', { sessionId: active }).catch(() => {}) }
    }, [target, attempt])
    const adapter = React.useMemo(() => ({
        getSessionId: () => session,
        getSessionPath: () => session,
        getStreamConfig: () => ({ id, type: cloud ? 'cloud' as const : 'home' as const, language: settings.preferred_game_language, host: '', resolution: 1080 as const }),
        getStreamStatus: async () => {
            const value = await Ipc.send('streaming', 'getPlayerState', { sessionId: session }) as { playerState?: string }
            return { state: value?.playerState === 'started' ? 'Provisioned' : !value || value.playerState === 'failed' ? 'Failed' : 'Provisioning' }
        },
        sendMSALToken: async () => {}, // Main process owns authentication and provisioning.
        sendSDPOffer: async (offer: RTCSessionDescriptionInit) => ({ exchangeResponse: JSON.stringify(await Ipc.send('streaming', 'sendSdp', { sessionId: session, sdp: offer.sdp })) }),
        sendICECandidates: async (candidates: string[]) => ({ exchangeResponse: JSON.stringify(await Ipc.send('streaming', 'sendIce', { sessionId: session, ice: candidates.map(candidate => JSON.parse(candidate)) })) }),
        sendChatSDP: async (offer: RTCSessionDescriptionInit) => { const answer = await Ipc.send('streaming', 'sendChatSdp', { sessionId: session, sdp: offer.sdp }); return answer.sdp },
        sendKeepalive: () => Ipc.send('streaming', 'sendKeepalive', { sessionId: session }),
    }), [session, id, cloud, settings.preferred_game_language])
    return <section className={'gl-experimental-stream gl-display-'+(['stretch','zoom'].includes(displayMode)?displayMode:'default')+(settings.video_enabled?'':' gl-video-disabled')} style={{'--gl-video-filter':videoFilterCss(filters)} as React.CSSProperties}>
        {filters.sharpening > 0 && <svg width='0' height='0' aria-hidden='true' style={{position:'absolute',pointerEvents:'none'}}><defs><filter id='gl-stream-sharpen' colorInterpolationFilters='sRGB'><feConvolveMatrix order={3} kernelMatrix={sharpeningKernel(filters.sharpening)} divisor={1} edgeMode='duplicate' preserveAlpha={true}/></filter></defs></svg>}
        {session && state !== 'Error' && <SharedPlayer communicationHandler={adapter} onStatusChanged={updateStatus} useWebGpu={settings.v3_renderer === 'webgpu'} autoGamepad consoleController={consoleController} vibration={settings.controller_vibration} videoBitrate={activeCap} showStats={hud} volume={volume} muted={muted} codecProfiles={settings.video_profiles || []} touchControls={touch} microphone={mic} onMicrophoneStatus={(active, error) => { setMicBusy(false); setMicActive(active); if (error) { setMicError(true); setMic(false) } }} nativeMouseKeyboard={settings.v3_native_mkb} deadzone={settings.v3_deadzone} invertY={settings.v3_invert_y} swapSticks={settings.v3_swap_sticks} mouseSensitivity={settings.v3_mouse_sensitivity} buttonMapping={settings.v3_button_mapping} onMetrics={recordMetrics} keyframeRequest={keyframeRequest} keyboardMapping={settings.input_mousekeyboard && !settings.v3_native_mkb ? settings.input_mousekeyboard_config : undefined} />}
        <button type="button" className="gl-stream-reveal btn" aria-label={t('dashboard.showStreamControls')} onClick={()=>{setControlsVisible(true);setControlsPinned(true)}} hidden={controlsVisible}>{t('dashboard.showStreamControls')} · F8</button><div ref={toolbar} className={"gl-experimental-controls"+(controlsVisible?"":" gl-controls-hidden")} onPointerEnter={()=>setToolbarHovered(true)} onPointerLeave={()=>setToolbarHovered(false)} onFocusCapture={()=>setToolbarFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setToolbarFocused(false)}}><span className="gl-stream-status" role="status">{t('dashboard.experimentalPlayer')} · {t('dashboard.streamState_'+state,{defaultValue:state})}</span><button type="button" className="btn" aria-pressed={controlsPinned} onClick={()=>setControlsPinned(value=>!value)}>{t('dashboard.pinControls')} · F8</button><button type="button" className="btn" aria-pressed={showFilters} onClick={()=>setShowFilters(value=>!value)}>{t('dashboard.videoFilters')}</button><button type="button" className="btn" aria-pressed={showSummary} onClick={() => setShowSummary(value => !value)}>{t('dashboard.connectionQuality')}</button><button type="button" className="btn" aria-pressed={showGraphs} onClick={()=>{setGraphSamples([...samples.current]);setShowGraphs(value=>!value)}}>{t('dashboard.networkGraphs')}</button><button type="button" className="btn" onClick={() => downloadDiagnostics(samples.current, cloud ? 'cloud' : 'home', state, settings.v3_renderer)}>{t('dashboard.exportDiagnostics')}</button><button type="button" className="btn" disabled={state!=='Connected'} onClick={()=>{const now=Date.now();if(now-lastRefresh>=3000){setLastRefresh(now);setKeyframeRequest(value=>value+1)}}}>{t('dashboard.refreshVideo')}</button><button type="button" className="btn" aria-pressed={hud} onClick={() => setHud(value => !value)}>{t('dashboard.performanceHud')}</button><button type="button" className="btn" disabled={state !== 'Connected' || micBusy} aria-pressed={micActive} onClick={() => { setMicError(false); setMicBusy(true); setMic(!mic) }}>{t(micActive ? 'streamWindow.disableMic' : 'streamWindow.enableMic')}</button>{!cloud && <button type='button' className='btn' aria-pressed={consoleController} onClick={()=>setConsoleController(value=>!value)}>{t('dashboard.consoleController')}</button>}<button type="button" className="btn" disabled={consoleController} aria-pressed={touch} onClick={() => setTouch(value => !value)}>{t('dashboard.touchControls')}</button><button type="button" className="btn" aria-pressed={muted} onClick={() => setMuted(value => !value)}>{t('dashboard.muteAudio')}</button><input type="range" min="0" max="1" step="0.01" aria-label={t('dashboard.volume')} value={volume} onChange={e => setVolume(Number(e.target.value))} /><button type='button' className='btn' disabled={!recordingActive&&(!recordingAvailable||Boolean(recordedClip))} aria-pressed={recordingActive} onClick={toggleRecording}>{t(recordingActive?'dashboard.stopRecording':'dashboard.startRecording')}</button><button type='button' className='btn' disabled={!captureAvailable||captureBusy} title={t('dashboard.captureStandardVideoHint')} onClick={()=>void captureFrame()}>{t('dashboard.screenshot')}</button><button type='button' className='btn' disabled={!pipAvailable&&!pipActive} aria-pressed={pipActive} title={t('dashboard.captureStandardVideoHint')} onClick={()=>void togglePip()}>{t(pipActive?'dashboard.exitPip':'dashboard.enterPip')}</button><button type="button" className="btn" aria-pressed={fullscreen} onClick={toggleFullscreen}>{t(fullscreen?'dashboard.exitFullscreen':'dashboard.fullscreen')}</button><button type="button" className="btn btn-cancel" onClick={()=>setConfirmEnd(true)}>{t('streamWindow.endStreamBtn')}</button></div>
        {restartCap!==null && <div className='gl-stream-modal' role='dialog' aria-modal='true' aria-label={t('dashboard.restartQuality')}><div><h2>{t('dashboard.restartQuality')}</h2><p>{t('dashboard.restartQualityWarning',{bitrate:Math.round(restartCap/1000)})}</p><button type='button' className='btn btn-primary' onClick={restartWithCap}>{t('dashboard.retryStream')}</button> <button type='button' className='btn' onClick={()=>setRestartCap(null)}>{t('dashboard.cancelBackup')}</button></div></div>}
        {confirmEnd && <div className='gl-stream-modal' role='dialog' aria-modal='true' aria-label={t('dashboard.confirmEndStream')}><div><h2>{t('dashboard.confirmEndStream')}</h2><p>{t('dashboard.endStreamDescription')}</p><button type='button' className='btn btn-cancel' onClick={endStream}>{t('streamWindow.endStreamBtn')}</button> <button type='button' className='btn' autoFocus onClick={()=>setConfirmEnd(false)}>{t('dashboard.cancelBackup')}</button></div></div>}
        {state!=='Connected'&&state!=='Error'&&<div className='gl-stream-connecting' role='status'><span className='gl-stream-spinner'/><strong>{t('dashboard.streamState_'+state,{defaultValue:state})}</strong><small>{t('dashboard.streamConnectingDescription')}</small></div>}
        {showGraphs && <NetworkGraphs samples={graphSamples} onClose={()=>setShowGraphs(false)}/>}
        {showFilters && <div className='gl-live-video-panel'><h2>{t('dashboard.videoFilters')}</h2><VideoFilterControls value={filters} onChange={setFilters}/><label>{t('settings.videoAudio.aspectSizeLabel')} <select value={displayMode} onChange={event=>setDisplayMode(event.target.value)}><option value='default'>{t('settings.videoAudio.aspectSizeValueDefault')}</option><option value='stretch'>{t('settings.videoAudio.aspectSizeValueStretch')}</option><option value='zoom'>{t('settings.videoAudio.aspectSizeValueZoom')}</option></select></label><div className='gl-console-toolbar'><button type='button' className='btn' onClick={()=>setSettings({...globalSettings,v3_video_filters:filters,video_size:displayMode})}>{t('dashboard.saveVideoDefaults')}</button><button type='button' className='btn' onClick={()=>setShowFilters(false)}>{t('dashboard.dismiss')}</button></div></div>}
        {settings.v3_native_mkb && state === 'Connected' && <div className="gl-performance-hud" style={{top:'auto',bottom:85}}>{t('dashboard.nativeMkbHint')}</div>}
        {showSummary && <div className="gl-performance-hud gl-quality-advice" style={{top:'auto',bottom:135}}><span>{t('dashboard.connectionQuality')}: {t('dashboard.quality_'+(summary?.quality || 'insufficient'))}</span><span>RTT p95: {summary?.rtt95 ?? '—'} ms</span><span>Jitter p95: {summary?.jitter95 ?? '—'} ms</span><span>{t('dashboard.averageBitrate')}: {summary?.averageBitrate ?? '—'} Mbps</span><span>{t('dashboard.qualityHint_'+(summary?.quality || 'insufficient'))}</span><span>{t('dashboard.currentBitrateCap')}: {activeCap?Math.round(activeCap/1000)+' Mbps':t('settings.streaming.unlimitedLabel')}</span>{recommendedCap!==null&&state==='Connected'&&<button type='button' className='btn' style={{pointerEvents:'auto'}} onClick={()=>setRestartCap(recommendedCap)}>{t('dashboard.lowerBitrateSuggestion',{bitrate:Math.round(recommendedCap/1000)})}</button>}</div>}
        {recordingActive&&<div className='gl-recording-indicator' role='status'><span/>REC {Math.floor(recordingElapsed/60)}:{String(recordingElapsed%60).padStart(2,'0')}</div>}
        {recordedClip&&<div className='gl-recording-result'><strong>{t('dashboard.clipReady')}</strong> · {(recordedClip.size/1048576).toFixed(1)} MiB <button type='button' className='btn' onClick={()=>{downloadRecording(recordedClip);setRecordedClip(null)}}>{t('dashboard.saveClip')}</button><button type='button' className='btn' onClick={()=>setRecordedClip(null)}>{t('dashboard.discardClip')}</button></div>}
        {captureMessage && <div className='gl-mic-error' role='status'>{t('dashboard.'+captureMessage)} <button type='button' className='btn' onClick={()=>setCaptureMessage('')}>{t('dashboard.dismiss')}</button></div>}
        {micError && <div className="gl-mic-error" role="alert">{t('dashboard.microphoneFailed')} <button className="btn" onClick={() => setMicError(false)}>{t('dashboard.dismiss')}</button></div>}
        {state === 'Error' && <div className="gl-experimental-error" role="alert">{t('dashboard.experimentalFailed')} <button className="btn btn-primary" onClick={retryStream}>{t('dashboard.retryStream')}</button> <button className="btn" onClick={onExit}>{t('dashboard.backHint')}</button></div>}
    </section>
}
