import { useStreamAwake } from '../../lib/useStreamAwake'
import { useDiscordPresence } from '../../lib/useDiscordPresence'
import React from 'react'
import { shortcutAction, validateShortcuts } from '../../lib/streamshortcuts'
import { recoveryDelay } from '../../lib/sessionrecovery'
import { SessionLifecycle } from '../../lib/sessionlifecycle'
import { startInstantReplay, replayDuration } from '../../lib/instantreplay'
import { startStreamRecording, recordingMimeType, downloadRecording } from '../../lib/streamrecording'
import { storeCapture } from '../../lib/capturelibrary'
import { currentVideo, canCapture, captureScreenshotBlob, saveStreamScreenshot, toggleStreamPictureInPicture } from '../../lib/streamcapture'
import NetworkGraphs from './networkgraphs'
import { recommendLowerBitrate, recoveryBitrate } from '../../lib/bitrateadvisor'
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
        return {...globalSettings, ...(profile || {}), xhome_resolution:!cloud ? game?.resolution ?? globalSettings.xhome_resolution : globalSettings.xhome_resolution, xcloud_resolution:cloud ? game?.resolution ?? globalSettings.xcloud_resolution : globalSettings.xcloud_resolution, xcloud_bitrate:cloud ? game?.bitrate ?? globalSettings.xcloud_bitrate : globalSettings.xcloud_bitrate, xhome_bitrate:!cloud ? game?.bitrate ?? globalSettings.xhome_bitrate : globalSettings.xhome_bitrate, v3_renderer:game && game.renderer !== 'default' ? game.renderer : globalSettings.v3_renderer}
    })
    const { t } = useTranslation()
    const [summary, setSummary] = React.useState<ReturnType<typeof summarizeDiagnostics> | null>(null)
    const [showSummary, setShowSummary] = React.useState(false)
    const [showGraphs,setShowGraphs] = React.useState(false)
    const [graphSamples,setGraphSamples] = React.useState<DiagnosticSample[]>([])
    const graphVisible=React.useRef(false)
    graphVisible.current=showGraphs
    const samples = React.useRef<DiagnosticSample[]>([])
    const failedAttempts=React.useRef<Array<{state:string;reason:string;samples:DiagnosticSample[]}>>([])
    const failureRef=React.useRef('')
    const noteFailure=React.useCallback((reason:string)=>{failureRef.current=reason;setFailureReason(reason)},[])
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
    const autoRecover=Boolean(globalSettings.v3_auto_reconnect)
    const [failureReason,setFailureReason]=React.useState('')
    const lifecycle=React.useRef(new SessionLifecycle())
    const exitRequested=React.useRef(false)
    const exitBusy=React.useRef(false)
    const [exitPhase,setExitPhase]=React.useState<'idle'|'stopping'|'failed'>('idle')
    const recoveryCount=React.useRef(0)
    const recoveredConnection=React.useRef(false)
    const [recoveryPending,setRecoveryPending]=React.useState(false)
    const [recoveryCancelled,setRecoveryCancelled]=React.useState(false)
    const [bitrateOverride,setBitrateOverride] = React.useState<number|null>(null)
    const [restartCap,setRestartCap] = React.useState<number|null>(null)
    const activeCap = bitrateOverride ?? (target.startsWith('xcloud_')?settings.xcloud_bitrate:settings.xhome_bitrate)
    const recommendedCap = summary ? recommendLowerBitrate(samples.current,activeCap) : null
    const [session, setSession] = React.useState('')
    const [state, setState] = React.useState('Initializing')
    useStreamAwake(session,state==='Connected'&&!target.startsWith('xcloud_')&&Boolean(globalSettings.stream_keep_awake))
    useDiscordPresence(session,state==='Connected'&&globalSettings.discord_presence_enabled===true,globalSettings.discord_application_id)
    const updateStatus = React.useCallback((value: string) => {
        if(exitRequested.current)return
        lastState.current = value
        if (value === 'Connected') { recoveredConnection.current=true; if(!connectedAt.current) connectedAt.current=Date.now() }
        if (value === 'Error') outcome.current = 'failed'
        if(value!=='Connected'){setMic(false);setMicActive(false);setMicBusy(false)}
        setState(value)
    }, [])
    React.useEffect(()=>{
        if(state!=='Connected')return
        const timer=setInterval(()=>{const last=samples.current[samples.current.length-1];if(last?.statsFresh===false&&(last.statsAgeMs??0)>=15000){noteFailure('stats');updateStatus('Error')}},1000)
        return()=>clearInterval(timer)
    },[state,updateStatus,noteFailure])
    const endStream=()=>{void requestExit()}
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
        const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){setShowFilters(false);setShowGraphs(false);setConfirmEnd(false);setRestartCap(null);reveal()}else if(event.key==='Tab')reveal()}
        const syncFullscreen=()=>setFullscreen(Boolean(document.fullscreenElement))
        window.addEventListener('pointermove',reveal);window.addEventListener('pointerdown',reveal);window.addEventListener('keydown',key);document.addEventListener('fullscreenchange',syncFullscreen);syncFullscreen();reveal()
        return()=>{clearTimeout(timer);window.removeEventListener('pointermove',reveal);window.removeEventListener('pointerdown',reveal);window.removeEventListener('keydown',key);document.removeEventListener('fullscreenchange',syncFullscreen)}
    },[state,controlsPinned,showFilters,confirmEnd,restartCap,toolbarFocused,toolbarHovered])
    const toggleFullscreen=()=>{const request=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();void request.catch(()=>{})}
    const retryStream=()=>{if(exitRequested.current)return;if(replaySaving||libraryBusy||captureBusy||recordedClip){setCaptureMessage('saveClipBeforeExit');return}if(recording.current){recording.current.stop();return}setRecoveryCancelled(true);setConfirmEnd(false);setShowFilters(false);setAttempt(value=>value+1)}
    const restartWithCap=()=>{if(restartCap===null||recordingActive||recordedClip||replaySaving||libraryBusy)return;setBitrateOverride(restartCap);setRestartCap(null);retryStream()}
    const [displayMode,setDisplayMode] = React.useState(settings.video_size)
    const [captureAvailable,setCaptureAvailable] = React.useState(false)
    const [pipAvailable,setPipAvailable] = React.useState(false)
    const [pipActive,setPipActive] = React.useState(false)
    const recording=React.useRef<ReturnType<typeof startStreamRecording>|null>(null)
    const [recordingActive,setRecordingActive]=React.useState(false)
    const [recordingElapsed,setRecordingElapsed]=React.useState(0)
    const [recordingAvailable,setRecordingAvailable]=React.useState(false)
    const [recordedClip,setRecordedClip]=React.useState<Blob|null>(null)
    const replay=React.useRef<ReturnType<typeof startInstantReplay>|null>(null)
    const [replayEnabled,setReplayEnabled]=React.useState(false)
    const replaySeconds=replayDuration(settings.v3_replay_seconds)
    const [replayReady,setReplayReady]=React.useState(false)
    const [replaySaving,setReplaySaving]=React.useState(false)
    const mounted=React.useRef(true)
    React.useEffect(()=>{if(!recordingActive&&!recordedClip&&!replaySaving)return;const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[recordingActive,recordedClip,replaySaving])
    const leaveStream=()=>{void requestExit()}
    React.useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;recording.current?.stop()}},[])
    React.useEffect(()=>{if(state!=='Connected')recording.current?.stop()},[state,session])
    React.useEffect(()=>{setRecordingAvailable(captureAvailable&&Boolean(recordingMimeType()))},[captureAvailable])
    React.useEffect(()=>{if(!recordingActive)return;const timer=setInterval(()=>setRecordingElapsed(Math.floor((Date.now()-(recording.current?.startedAt??Date.now()))/1000)),1000);return()=>clearInterval(timer)},[recordingActive])
    const toggleRecording=()=>{if(replayEnabled||replay.current||replaySaving)return;if(recording.current){recording.current.stop();return}const video=currentVideo();if(!canCapture(video)||!recordingAvailable||recordedClip)return;try{recording.current=startStreamRecording(video,(blob,error)=>{recording.current=null;if(!mounted.current)return;setRecordingActive(false);setRecordedClip(blob);setCaptureMessage(error?'recordingFailed':'recordingStopped')},undefined,{seconds:settings.recording_seconds,videoBitsPerSecond:settings.recording_bitrate});setRecordingElapsed(0);setRecordingActive(true)}catch{setCaptureMessage('recordingFailed')}}
    const [libraryBusy,setLibraryBusy]=React.useState(false)
    const [captureBusy,setCaptureBusy] = React.useState(false)
    const [captureMessage,setCaptureMessage] = React.useState('')
    const requestExit=async()=>{
        if(exitBusy.current)return
        if(replaySaving||libraryBusy||captureBusy||recordedClip){setConfirmEnd(false);setCaptureMessage('saveClipBeforeExit');return}
        if(recording.current){recording.current.stop();setConfirmEnd(false);return}
        exitBusy.current=true;exitRequested.current=true
        setRecoveryCancelled(true);setRecoveryPending(false)
        setConfirmEnd(false);setShowFilters(false);setShowGraphs(false);setRestartCap(null)
        setExitPhase('stopping');setState('Stopping');lastState.current='Stopping'
        outcome.current='ended'
        setSession('')
        const stopped=await lifecycle.current.end()
        exitBusy.current=false
        if(!mounted.current)return
        if(stopped){onExit();return}
        setExitPhase('failed')
    }
    React.useEffect(()=>{
        if(state!=='Connected'||!settings.video_enabled){setCaptureAvailable(false);setPipAvailable(false);setPipActive(false);return}
        let surface:HTMLVideoElement|null=null
        const update=()=>{const video=currentVideo();if(video!==surface){surface?.removeEventListener('enterpictureinpicture',update);surface?.removeEventListener('leavepictureinpicture',update);surface=video;surface?.addEventListener('enterpictureinpicture',update);surface?.addEventListener('leavepictureinpicture',update)}const ready=canCapture(video);setCaptureAvailable(ready);setPipAvailable(ready&&Boolean(document.pictureInPictureEnabled)&&typeof video.requestPictureInPicture==='function');setPipActive(Boolean(video&&document.pictureInPictureElement===video))}
        update();const timer=setInterval(update,1000)
        return()=>{clearInterval(timer);surface?.removeEventListener('enterpictureinpicture',update);surface?.removeEventListener('leavepictureinpicture',update);if(surface&&document.pictureInPictureElement===surface)void document.exitPictureInPicture().catch(()=>{})}
    },[state,session,settings.video_enabled])
    React.useEffect(()=>{if(!captureMessage)return;const timer=setTimeout(()=>setCaptureMessage(''),4000);return()=>clearTimeout(timer)},[captureMessage])
    const captureFrame=async()=>{if(captureBusy||state!=='Connected'||!settings.video_enabled)return;setCaptureBusy(true);try{await saveStreamScreenshot(currentVideo());setCaptureMessage('screenshotReady')}catch{setCaptureMessage('screenshotFailed')}finally{setCaptureBusy(false)}}
    const saveCaptureToLibrary=async(kind:'screenshot'|'clip')=>{
        if(libraryBusy)return
        if(kind==='screenshot'&&(state!=='Connected'||!captureAvailable))return
        if(kind==='clip'&&!recordedClip)return
        setLibraryBusy(true)
        try{const blob=kind==='clip'?recordedClip:await captureScreenshotBlob(currentVideo());if(!blob)return;await storeCapture(kind,blob);if(kind==='clip')setRecordedClip(null);setCaptureMessage('captureLibrarySaved')}catch{setCaptureMessage('captureLibraryFailed')}finally{setLibraryBusy(false)}
    }
    React.useEffect(()=>{
        if(!replayEnabled||state!=='Connected'||!recordingAvailable||recordingActive){setReplayReady(false);return}
        const video=currentVideo();if(!canCapture(video)){setReplayEnabled(false);return}
        let active=true
        try{replay.current=startInstantReplay(video,ready=>{if(active)setReplayReady(ready)},()=>{if(active){setReplayEnabled(false);setCaptureMessage('replayFailed')}},replaySeconds)}catch{setReplayEnabled(false);setCaptureMessage('replayFailed')}
        return()=>{active=false;replay.current?.dispose();replay.current=null;setReplayReady(false)}
    },[replayEnabled,state,session,recordingAvailable,recordingActive,replaySeconds])
    React.useEffect(()=>{if(state!=='Connected')setReplayEnabled(false)},[state])
    const saveReplay=async()=>{if(!replay.current||replaySaving||recordedClip)return;setReplaySaving(true);try{const blob=await replay.current.save();if(!mounted.current)return;if(blob){setRecordedClip(blob);setCaptureMessage('replaySaved')}else setCaptureMessage('replayFailed')}catch{if(mounted.current)setCaptureMessage('replayFailed')}finally{if(mounted.current)setReplaySaving(false)}}
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
    React.useEffect(()=>{
        setRecoveryPending(false)
        if(exitRequested.current||state!=='Error'||recoveryCancelled||recordingActive||recordedClip||replaySaving||libraryBusy||captureBusy)return
        const delay=recoveryDelay(autoRecover,cloud,recoveredConnection.current,recoveryCount.current)
        if(delay===null)return
        setRecoveryPending(true)
        const timer=setTimeout(()=>{if(exitRequested.current)return;const lower=recoveryBitrate(samples.current,activeCap,failureRef.current,Boolean(globalSettings.v3_adaptive_recovery));if(lower!==null)setBitrateOverride(lower);recoveryCount.current++;setRecoveryPending(false);setAttempt(value=>value+1)},delay)
        return()=>clearTimeout(timer)
    },[state,autoRecover,cloud,recoveryCancelled,recordingActive,recordedClip,replaySaving,libraryBusy,captureBusy,attempt,activeCap,globalSettings.v3_adaptive_recovery])
    const resolution:720|1080 = (cloud?settings.xcloud_resolution:settings.xhome_resolution)===720?720:1080
    const consoleController = !cloud && Boolean(globalSettings.v3_console_controller)
    React.useEffect(() => {
        if(exitRequested.current)return
        if(samples.current.length){failedAttempts.current.push({state:lastState.current,reason:failureRef.current,samples:[...samples.current]});if(failedAttempts.current.length>3)failedAttempts.current.shift()}
        failureRef.current=''
        samples.current = []; sampleCount.current = 0; started.current = Date.now(); connectedAt.current = 0; outcome.current = 'interrupted'; lastState.current = 'Initializing'; setSummary(null); setGraphSamples([])
        setSession(''); setFailureReason(''); setState('Initializing'); setMic(false); setMicBusy(false); setMicActive(false); setMicError(false)
        const dispose=lifecycle.current.begin({
            start:()=>Ipc.send('streaming','startStream',{type:cloud?'cloud':'home',target:id,resolution}),
            stop:sessionId=>Ipc.send('streaming','stopStream',{sessionId}),
            onSession:id=>{if(!exitRequested.current)setSession(id)},
            onError:reason=>{if(!exitRequested.current){noteFailure(reason);updateStatus('Error')}}
        })
        return ()=>{dispose();if(settings.v3_session_history&&(connectedAt.current||lastState.current==='Error'))addSession(makeSessionRecord(started.current,connectedAt.current,Date.now(),cloud?'cloud':'home',outcome.current,samples.current))}

    }, [target, attempt])
    const shortcuts=validateShortcuts(globalSettings.v3_stream_shortcuts)
    const shortcutHandler=React.useRef<(event:KeyboardEvent)=>void>(()=>{})
    shortcutHandler.current=(event)=>{
        if(exitRequested.current)return
        const editable=event.target instanceof HTMLElement && (event.target.isContentEditable || Boolean(event.target.closest('input,textarea,select,[contenteditable=true]')))
        const action=shortcutAction(shortcuts,{key:event.key,repeat:event.repeat,altKey:event.altKey,ctrlKey:event.ctrlKey,metaKey:event.metaKey,shiftKey:event.shiftKey,editable})
        if(!action || event.defaultPrevented || (settings.v3_native_mkb && !consoleController && document.pointerLockElement) || (!consoleController && settings.input_mousekeyboard && Object.prototype.hasOwnProperty.call(settings.input_mousekeyboard_config,event.key)))return
        event.preventDefault();event.stopImmediatePropagation()
        if(action==='controls'){setControlsVisible(true);setControlsPinned(value=>!value)}
        else if(action==='fullscreen')toggleFullscreen()
        else if(action==='mute')setMuted(value=>!value)
        else if(action==='hud')setHud(value=>!value)
        else if(action==='graphs'){setGraphSamples([...samples.current]);setShowGraphs(value=>!value)}
        else if(action==='screenshot'&&captureAvailable)void captureFrame()
        else if(action==='recording'&&(recordingActive||recordingAvailable&&!recordedClip))toggleRecording()
        else if(action==='replay'&&replayEnabled&&!replaySaving&&!recordedClip)void saveReplay()
    }
    React.useEffect(()=>{const key=(event:KeyboardEvent)=>shortcutHandler.current(event);window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)},[])
    const adapter = React.useMemo(() => ({
        getSessionId: () => session,
        getSessionPath: () => session,
        getStreamConfig: () => ({ id, type: cloud ? 'cloud' as const : 'home' as const, language: settings.preferred_game_language, host: '', resolution }),
        getStreamStatus: async () => {
            const value = await Ipc.send('streaming', 'getPlayerState', { sessionId: session }) as { playerState?: string }
            return { state: value?.playerState === 'started' ? 'Provisioned' : !value || value.playerState === 'failed' ? 'Failed' : 'Provisioning' }
        },
        sendMSALToken: async () => {}, // Main process owns authentication and provisioning.
        sendSDPOffer: async (offer: RTCSessionDescriptionInit) => ({ exchangeResponse: JSON.stringify(await Ipc.send('streaming', 'sendSdp', { sessionId: session, sdp: offer.sdp })) }),
        sendICECandidates: async (candidates: string[]) => ({ exchangeResponse: JSON.stringify(await Ipc.send('streaming', 'sendIce', { sessionId: session, ice: candidates.map(candidate => JSON.parse(candidate)) })) }),
        sendChatSDP: async (offer: RTCSessionDescriptionInit) => { const answer = await Ipc.send('streaming', 'sendChatSdp', { sessionId: session, sdp: offer.sdp }); return answer.sdp },
        sendKeepalive: () => Ipc.send('streaming', 'sendKeepalive', { sessionId: session }),
    }), [session, id, cloud, resolution, settings.preferred_game_language])
    return <section className={'gl-experimental-stream gl-display-'+(['stretch','zoom'].includes(displayMode)?displayMode:'default')+(settings.video_enabled?'':' gl-video-disabled')} style={{'--gl-video-filter':videoFilterCss(filters)} as React.CSSProperties}>
        {filters.sharpening > 0 && <svg width='0' height='0' aria-hidden='true' style={{position:'absolute',pointerEvents:'none'}}><defs><filter id='gl-stream-sharpen' colorInterpolationFilters='sRGB'><feConvolveMatrix order={3} kernelMatrix={sharpeningKernel(filters.sharpening)} divisor={1} edgeMode='duplicate' preserveAlpha={true}/></filter></defs></svg>}
        {exitPhase==='idle' && session && state !== 'Error' && <SharedPlayer communicationHandler={adapter} onStatusChanged={updateStatus} onFailureReason={noteFailure} useWebGpu={settings.v3_renderer === 'webgpu'} autoGamepad multiController={settings.v3_multi_controller} consoleController={consoleController} vibration={settings.controller_vibration} videoBitrate={activeCap} showStats={hud} volume={volume} muted={muted} codecProfiles={settings.video_profiles || []} touchControls={touch} microphone={mic} onMicrophoneStatus={(active, error) => { setMicBusy(false); setMicActive(active); if (error) { setMicError(true); setMic(false) } }} nativeMouseKeyboard={settings.v3_native_mkb} deadzone={settings.v3_deadzone} invertY={settings.v3_invert_y} swapSticks={settings.v3_swap_sticks} mouseSensitivity={settings.v3_mouse_sensitivity} buttonMapping={settings.v3_button_mapping} onMetrics={recordMetrics} keyframeRequest={keyframeRequest} keyboardMapping={settings.input_mousekeyboard && !settings.v3_native_mkb ? settings.input_mousekeyboard_config : undefined} />}
        {exitPhase==='idle'&&<><button type="button" className="gl-stream-reveal btn" aria-label={t('dashboard.showStreamControls')} onClick={()=>{setControlsVisible(true);setControlsPinned(true)}} hidden={controlsVisible}>{t('dashboard.showStreamControls')}{shortcuts.controls?' · '+shortcuts.controls:''}</button><div ref={toolbar} className={"gl-experimental-controls"+(controlsVisible?"":" gl-controls-hidden")} onPointerEnter={()=>setToolbarHovered(true)} onPointerLeave={()=>setToolbarHovered(false)} onFocusCapture={()=>setToolbarFocused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setToolbarFocused(false)}}><span className="gl-stream-status" role="status">{t('dashboard.experimentalPlayer')} · {t('dashboard.streamState_'+state,{defaultValue:state})}</span><button type="button" className="btn" aria-pressed={controlsPinned} onClick={()=>setControlsPinned(value=>!value)}>{t('dashboard.pinControls')}{shortcuts.controls?' · '+shortcuts.controls:''}</button><button type="button" className="btn" aria-pressed={showFilters} onClick={()=>setShowFilters(value=>!value)}>{t('dashboard.videoFilters')}</button><button type="button" className="btn" aria-pressed={showSummary} onClick={() => setShowSummary(value => !value)}>{t('dashboard.connectionQuality')}</button><button type="button" className="btn" aria-pressed={showGraphs} onClick={()=>{setGraphSamples([...samples.current]);setShowGraphs(value=>!value)}}>{t('dashboard.networkGraphs')}</button><button type="button" className="btn" onClick={() => downloadDiagnostics(samples.current, cloud ? 'cloud' : 'home', state, settings.v3_renderer, failedAttempts.current, failureRef.current)}>{t('dashboard.exportDiagnostics')}</button><button type="button" className="btn" disabled={state!=='Connected'} onClick={()=>{const now=Date.now();if(now-lastRefresh>=3000){setLastRefresh(now);setKeyframeRequest(value=>value+1)}}}>{t('dashboard.refreshVideo')}</button><button type="button" className="btn" aria-pressed={hud} onClick={() => setHud(value => !value)}>{t('dashboard.performanceHud')}</button><button type="button" className="btn" disabled={state !== 'Connected' || micBusy} aria-pressed={micActive} onClick={() => { setMicError(false); setMicBusy(true); setMic(!mic) }}>{t(micActive ? 'streamWindow.disableMic' : 'streamWindow.enableMic')}</button>{!cloud && <button type='button' className='btn' aria-pressed={autoRecover} onClick={()=>{setSettings({...globalSettings,v3_auto_reconnect:!autoRecover});setRecoveryCancelled(false);recoveryCount.current=0}}>{t('dashboard.autoRecovery')}</button>}{!cloud && <button type='button' className='btn' aria-pressed={consoleController} onClick={()=>setSettings({...globalSettings,v3_console_controller:!consoleController})}>{t('dashboard.consoleController')}</button>}<button type="button" className="btn" disabled={consoleController} aria-pressed={touch} onClick={() => setTouch(value => !value)}>{t('dashboard.touchControls')}</button><button type="button" className="btn" aria-pressed={muted} onClick={() => setMuted(value => !value)}>{t('dashboard.muteAudio')}</button><input type="range" min="0" max="1" step="0.01" aria-label={t('dashboard.volume')} value={volume} onChange={e => setVolume(Number(e.target.value))} /><button type='button' className='btn' disabled={replayEnabled||replaySaving||!recordingActive&&(!recordingAvailable||Boolean(recordedClip))} aria-pressed={recordingActive} onClick={toggleRecording}>{t(recordingActive?'dashboard.stopRecording':'dashboard.startRecording')}</button><button type='button' className='btn' disabled={recordingActive||!recordingAvailable||replaySaving} aria-pressed={replayEnabled} onClick={()=>setReplayEnabled(value=>!value)}>{t('dashboard.instantReplay')}</button><button type='button' className='btn' disabled={!replayEnabled||replaySaving||Boolean(recordedClip)} onClick={()=>void saveReplay()}>{t('dashboard.saveReplay')}</button><button type='button' className='btn' disabled={!captureAvailable||captureBusy} title={t('dashboard.captureStandardVideoHint')} onClick={()=>void captureFrame()}>{t('dashboard.screenshot')}</button><button type='button' className='btn' disabled={!captureAvailable||libraryBusy} onClick={()=>void saveCaptureToLibrary('screenshot')}>{t('dashboard.screenshotToLibrary')}</button><button type='button' className='btn' disabled={!pipAvailable&&!pipActive} aria-pressed={pipActive} title={t('dashboard.captureStandardVideoHint')} onClick={()=>void togglePip()}>{t(pipActive?'dashboard.exitPip':'dashboard.enterPip')}</button><button type="button" className="btn" aria-pressed={fullscreen} onClick={toggleFullscreen}>{t(fullscreen?'dashboard.exitFullscreen':'dashboard.fullscreen')}</button><button type="button" className="btn btn-cancel" onClick={()=>setConfirmEnd(true)}>{t('streamWindow.endStreamBtn')}</button></div></>}
        {restartCap!==null && <div className='gl-stream-modal' role='dialog' aria-modal='true' aria-label={t('dashboard.restartQuality')}><div><h2>{t('dashboard.restartQuality')}</h2><p>{t('dashboard.restartQualityWarning',{bitrate:Math.round(restartCap/1000)})}</p><button type='button' className='btn btn-primary' disabled={recordingActive||Boolean(recordedClip)||replaySaving||libraryBusy} onClick={restartWithCap}>{t('dashboard.retryStream')}</button> <button type='button' className='btn' onClick={()=>setRestartCap(null)}>{t('dashboard.cancelBackup')}</button></div></div>}
        {confirmEnd && <div className='gl-stream-modal' role='dialog' aria-modal='true' aria-label={t('dashboard.confirmEndStream')}><div><h2>{t('dashboard.confirmEndStream')}</h2><p>{t('dashboard.endStreamDescription')}</p><button type='button' className='btn btn-cancel' onClick={endStream}>{t('streamWindow.endStreamBtn')}</button> <button type='button' className='btn' autoFocus onClick={()=>setConfirmEnd(false)}>{t('dashboard.cancelBackup')}</button></div></div>}
        {exitPhase==='idle'&&state!=='Connected'&&state!=='Error'&&<div className='gl-stream-connecting' role='status'><span className='gl-stream-spinner'/><strong>{t('dashboard.streamState_'+state,{defaultValue:state})}</strong><small>{t('dashboard.streamConnectingDescription')}</small></div>}
        {showGraphs && <NetworkGraphs samples={graphSamples} onClose={()=>setShowGraphs(false)}/>}
        {showFilters && <div className='gl-live-video-panel'><h2>{t('dashboard.videoFilters')}</h2><VideoFilterControls value={filters} onChange={setFilters}/><label>{t('settings.videoAudio.aspectSizeLabel')} <select value={displayMode} onChange={event=>setDisplayMode(event.target.value)}><option value='default'>{t('settings.videoAudio.aspectSizeValueDefault')}</option><option value='stretch'>{t('settings.videoAudio.aspectSizeValueStretch')}</option><option value='zoom'>{t('settings.videoAudio.aspectSizeValueZoom')}</option></select></label><div className='gl-console-toolbar'><button type='button' className='btn' onClick={()=>setSettings({...globalSettings,v3_video_filters:filters,video_size:displayMode})}>{t('dashboard.saveVideoDefaults')}</button><button type='button' className='btn' onClick={()=>setShowFilters(false)}>{t('dashboard.dismiss')}</button></div></div>}
        {settings.v3_native_mkb && state === 'Connected' && <div className="gl-performance-hud" style={{top:'auto',bottom:85}}>{t('dashboard.nativeMkbHint')}</div>}
        {showSummary && <div className="gl-performance-hud gl-quality-advice" style={{top:'auto',bottom:135}}><span>{t('dashboard.connectionQuality')}: {t('dashboard.quality_'+(summary?.quality || 'insufficient'))}</span><span>RTT p95: {summary?.rtt95 ?? '—'} ms</span><span>Jitter p95: {summary?.jitter95 ?? '—'} ms</span><span>{t('dashboard.averageBitrate')}: {summary?.averageBitrate ?? '—'} Mbps</span><span>{t('dashboard.qualityHint_'+(summary?.quality || 'insufficient'))}</span><span>{t('dashboard.requestedResolution')}: {resolution}p</span><span>{t('dashboard.currentBitrateCap')}: {activeCap?Math.round(activeCap/1000)+' Mbps':t('settings.streaming.unlimitedLabel')}</span>{bitrateOverride!==null&&<span>{t('dashboard.sessionQualityOverride')}</span>}{recommendedCap!==null&&state==='Connected'&&<button type='button' className='btn' style={{pointerEvents:'auto'}} onClick={()=>setRestartCap(recommendedCap)}>{t('dashboard.lowerBitrateSuggestion',{bitrate:Math.round(recommendedCap/1000)})}</button>}</div>}
        {replayEnabled&&<div className='gl-replay-indicator' role='status'>{t(replayReady?'dashboard.replayReady':'dashboard.replayBuffering',{seconds:replaySeconds})}</div>}
        {recordingActive&&<div className='gl-recording-indicator' role='status'><span/>REC {Math.floor(recordingElapsed/60)}:{String(recordingElapsed%60).padStart(2,'0')}</div>}
        {recordedClip&&<div className='gl-recording-result'><strong>{t('dashboard.clipReady')}</strong> · {(recordedClip.size/1048576).toFixed(1)} MiB <button type='button' className='btn' disabled={libraryBusy} onClick={()=>{downloadRecording(recordedClip);setRecordedClip(null)}}>{t('dashboard.saveClip')}</button><button type='button' className='btn' disabled={libraryBusy} onClick={()=>void saveCaptureToLibrary('clip')}>{t('dashboard.saveToLibrary')}</button><button type='button' className='btn' disabled={libraryBusy} onClick={()=>setRecordedClip(null)}>{t('dashboard.discardClip')}</button></div>}
        {captureMessage && <div className='gl-mic-error' role='status'>{t('dashboard.'+captureMessage)} <button type='button' className='btn' onClick={()=>setCaptureMessage('')}>{t('dashboard.dismiss')}</button></div>}
        {micError && <div className="gl-mic-error" role="alert">{t('dashboard.microphoneFailed')} <button className="btn" onClick={() => setMicError(false)}>{t('dashboard.dismiss')}</button></div>}
        {exitPhase==='stopping'&&<div className='gl-experimental-error' role='status'>{t('dashboard.classicStopping')}</div>}
        {exitPhase==='failed'&&<div className='gl-experimental-error' role='alert'><p>{t('dashboard.classicFailure_stop')}</p><button type='button' className='btn btn-primary' onClick={()=>void requestExit()}>{t('dashboard.classicRetryStop')}</button></div>}
        {exitPhase==='idle'&&state === 'Error' && <div className="gl-experimental-error" role="alert">{t('dashboard.experimentalFailed')} {failureReason&&<p>{t('dashboard.failure_'+failureReason)}</p>} <button className="btn btn-primary" disabled={recordingActive||Boolean(recordedClip)||replaySaving||libraryBusy} onClick={retryStream}>{t('dashboard.retryStream')}</button> <button className="btn" onClick={leaveStream}>{t('dashboard.backHint')}</button>{recoveryPending&&<p role='status'>{t('dashboard.recoveryPending')} <button type='button' className='btn' onClick={()=>setRecoveryCancelled(true)}>{t('dashboard.cancelBackup')}</button></p>}</div>}
    </section>
}
