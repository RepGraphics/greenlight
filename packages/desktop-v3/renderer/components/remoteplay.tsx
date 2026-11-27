import {useCallback,useEffect,useRef,useState,type CSSProperties} from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import {ArrowLeft, Play} from 'lucide-react'
import DashboardInput from '../../../desktop/renderer/components/ui/dashboardinput'
import CaptureControls from './capturecontrols'
import type {WebCaptureSession} from '../utils/webcapture'
import FullscreenSurface from './fullscreensurface'
import StreamDiagnostics from './streamdiagnostics'
import {webQualityAdvice} from '../utils/webqualityadvice'
import {appendWebDiagnostic} from '../utils/webdiagnostics'
import type {DiagnosticSample} from '../../../desktop/renderer/lib/streamdiagnostics'
import ControllerCalibration from './controllercalibration'
import PictureInPictureControl from './pictureinpicturecontrol'
import VideoAppearance from './videoappearance'
import {webVideoPresentation} from '../utils/videoappearance'
import {useAuth} from '../contexts/AuthContext'
import {useStreamPreferences} from '../contexts/StreamPreferencesContext'
import {deviceWebSetup,resolveWebSetup} from '../utils/websetuppresets'
import {useTRPCClient} from '../utils/trpc'
import {createRemoteSession,selectStreamCredentials,type WebStreamTarget} from '../utils/remotesession'
import {startFailureDetails,startFailureReason,type StartFailureReason} from '../utils/startfailure'
import {SessionLifecycle} from '../../../desktop/renderer/lib/sessionlifecycle'
import {parseSessionBitrate,sessionBitrates,sessionBitrateLabel} from '../../../desktop/renderer/lib/sessionquality'
import {webSessionInputOptions,type WebTouchMode} from '../utils/sessionoptions'
import ControllerBindings from './controllerbindings'
import {webControllerPresets,selectWebControllerPreset,parseWebDeadzone,parseWebVolume,webControllerOptions} from '../utils/controlleroptions'
import {webMicrophoneSupported,microphoneRequested,toggleWebMicrophone,webMicrophoneResult,type WebMicrophoneState} from '../utils/microphoneoptions'
import type {communicationHandler} from '@greenlight/player/client'

const SharedPlayer=dynamic(()=>import('@greenlight/player/client').then(module=>module.StreamPlayer),{ssr:false})
type Phase='idle'|'starting'|'playing'|'startFailed'|'stopping'|'stopFailed'
const handshakeFailureMessage: Record<string,string> = {
    'sdp-offer': 'Greenlight couldn’t prepare the WebRTC offer.',
    'sdp-exchange': 'Xbox didn’t complete the WebRTC offer exchange.',
    'sdp-answer': 'Greenlight couldn’t apply the WebRTC answer from Xbox.',
    'ice-exchange': 'Xbox didn’t complete the network route exchange.',
    'ice-connect': 'Greenlight and Xbox couldn’t establish a working network route.',
}
export default function RemotePlay({target,onExit}:{target:WebStreamTarget;onExit:()=>void}){
    const {getxHomeToken,getxCloudToken,getUserRefreshToken,authState,desktop,setupPresets,rememberSetup,forgetSetup}=useAuth()
    const {preferences,savePreferences,storageAvailable}=useStreamPreferences()
    const cloud=target.type==='cloud'
    const [initial]=useState(()=>resolveWebSetup(target.type,preferences,setupPresets))
    const mode=cloud?'Cloud Gaming':'Remote Play'
    const client=useTRPCClient()
    const lifecycle=useRef(new SessionLifecycle())
    const setupScope=useRef<HTMLElement>(null)
    const playerSurface=useRef<HTMLDivElement|null>(null)
    const mounted=useRef(false)
    const phaseRef=useRef<Phase>('idle')
    const [phase,setPhase]=useState<Phase>('idle')
    const [status,setStatus]=useState('Initializing')
    const [samples,setSamples]=useState<DiagnosticSample[]>([])
    const [failureReason,setFailureReason]=useState('')
    const [startupFailure,setStartupFailure]=useState<StartFailureReason>('start-unconfirmed')
    const [defaultsUpdated,setDefaultsUpdated]=useState(false)
    const [setupMessage,setSetupMessage]=useState('')
    const [captureRetained,setCaptureRetained]=useState(false)
    const captureSession=useRef<WebCaptureSession|null>(null)
    const captureRetainedRef=useRef(false)
    const captureChanged=useCallback((retained:boolean)=>{captureRetainedRef.current=retained;setCaptureRetained(retained)},[])
    const [leaveRequested,setLeaveRequested]=useState(false)
    const pendingSetupBitrate=useRef<number|undefined>(undefined)
    const exitDestination=useRef<'browse'|'setup'>('browse')
    const diagnosticStart=useRef(0)
    const [adapter,setAdapter]=useState<communicationHandler|null>(null)
    const [resolution,setResolution]=useState(initial.resolution)
    const [bitrate,setBitrate]=useState(initial.bitrate)
    const [consolePaired,setConsolePaired]=useState(initial.consolePaired)
    const [multipleControllers,setMultipleControllers]=useState(initial.multipleControllers)
    const [keyframe,setKeyframe]=useState(0)
    const [muted,setMuted]=useState(preferences.muted)
    const [micAvailable,setMicAvailable]=useState(false)
    const [mic,setMic]=useState<WebMicrophoneState>('off')
    const [volume,setVolume]=useState(initial.volume)
    const [showStats,setShowStats]=useState(initial.showStats)
    const [filters,setFilters]=useState(initial.filters)
    const presentation=webVideoPresentation(filters)
    const [profile,setProfile]=useState(initial.profile)
    const [preset,setPreset]=useState<string>(
        setupPresets[target.type]!==null||preferences.deadzone!==null||preferences.invertY!==null||preferences.swapSticks!==null||preferences.buttonMapping!==null
            ?'custom':preferences.preset
    )
    const [advancedOpen,setAdvancedOpen]=useState(false)
    const [vibration,setVibration]=useState(initial.vibration)
    const [touch,setTouch]=useState<WebTouchMode>(initial.touch)
    const [keyboard,setKeyboard]=useState(initial.keyboard)
    const inputOptions=webSessionInputOptions(target.type,consolePaired,multipleControllers,touch,keyboard)
    const controllerOptions=webControllerOptions(profile,vibration,inputOptions.consoleController)
    const [guide,setGuide]=useState(0)
    const [guideMissing,setGuideMissing]=useState(false)
    const transition=(value:Phase)=>{phaseRef.current=value;if(mounted.current)setPhase(value)}
    const failStart=(cause:unknown)=>{
        const reason=startFailureReason(cause)
        setStartupFailure(reason)
        setFailureReason(reason)
        setStatus('Failed')
        transition('startFailed')
    }
    useEffect(()=>{
        mounted.current=true
        setMicAvailable(webMicrophoneSupported(window.isSecureContext,navigator.mediaDevices))
        const warn=(event:BeforeUnloadEvent)=>{
            if(phaseRef.current==='idle'&&!captureRetainedRef.current)return
            event.preventDefault();event.returnValue=''
        }
        const hide=()=>{if(document.hidden)setMic('off')}
        window.addEventListener('beforeunload',warn)
        document.addEventListener('visibilitychange',hide)
        return()=>{
            mounted.current=false
            window.removeEventListener('beforeunload',warn)
            document.removeEventListener('visibilitychange',hide)
            if(phaseRef.current!=='idle')void lifecycle.current.end()
        }
    },[])
    const start=()=>{
        if(phaseRef.current!=='idle')return
        setLeaveRequested(false)
        diagnosticStart.current=performance.now();setSamples([]);setFailureReason('')
        try{
            const {token,host}=selectStreamCredentials(target,getxHomeToken(),getxCloudToken(),{
                home:authState?.streamingTokens?.xHomeToken?.data.offeringSettings?.regions,
                cloud:authState?.streamingTokens?.xCloudToken?.data.offeringSettings?.regions,
            })
            const authorization=desktop?{kind:'desktop' as const}:{kind:'web' as const,refreshToken:getUserRefreshToken()||''}
            const remote=createRemoteSession({
                start:input=>client.streaming_start_stream.mutate(input),
                stop:input=>client.streaming_stop_stream.mutate(input),
                status:input=>client.streaming_get_status.mutate(input),
                sdp:input=>client.streaming_send_sdp_offer.mutate(input),
                chat:input=>client.streaming_send_chat_sdp.mutate({...input,offer:{type:'offer',sdp:input.offer.sdp??''}}),
                ice:input=>client.streaming_send_ice_candidates.mutate(input),
                connect:input=>client.streaming_send_msal_token.mutate(input),
                keepalive:input=>client.streaming_send_keepalive.mutate(input),
            },{id:target.id,type:target.type,host,language:preferences.gameLanguage||token.language,resolution},token,authorization,message=>{
                if(mounted.current&&phaseRef.current==='playing')setStatus(message)
            })
            transition('starting');setStatus('Provisioning')
            lifecycle.current.begin({
                start:remote.start,
                stop:remote.stop,
                onSession:path=>{
                    if(!mounted.current||phaseRef.current!=='starting')return
                    setAdapter(remote.player(path));transition('playing')
                },
                onError:(reason,cause)=>{
                    if(!mounted.current||phaseRef.current!=='starting')return
                    if(reason==='stop')transition('stopFailed')
                    else failStart(cause)
                },
            })
        }catch(cause){failStart(cause)}
    }
    const leaveSetup=()=>{if(captureRetainedRef.current){setLeaveRequested(true);return}onExit()}
    const end=async(destination:'browse'|'setup'='browse',nextBitrate?:number)=>{
        if(phaseRef.current==='stopping')return
        if(phaseRef.current==='idle'){leaveSetup();return}
        // Keep the page alive if an explicitly requested capture is pending or ready.
        if(destination==='browse'&&captureRetainedRef.current)destination='setup'
        if(phaseRef.current!=='stopFailed'||destination!==exitDestination.current||nextBitrate!==undefined)pendingSetupBitrate.current=destination==='setup'?nextBitrate:undefined
        exitDestination.current=destination
        captureSession.current?.suspendLiveCapture()
        transition('stopping');setMic('off');setAdapter(null)
        const stopped=await lifecycle.current.end()
        if(!mounted.current)return
        if(stopped){
            transition('idle');setStatus('Initializing');setGuideMissing(false)
            if(destination==='browse')onExit()
            else if(pendingSetupBitrate.current!==undefined)setBitrate(pendingSetupBitrate.current)
            pendingSetupBitrate.current=undefined
        }
        else transition('stopFailed')
    }
    const advice=phase==='playing'&&status==='Connected'?webQualityAdvice(samples,bitrate,Math.max(0,(typeof performance==='undefined'?0:performance.now())-diagnosticStart.current)/1000,status):null
    const applyAdvice=()=>{
        if(phaseRef.current!=='playing'||status!=='Connected')return
        const cap=webQualityAdvice(samples,bitrate,(performance.now()-diagnosticStart.current)/1000,status)
        if(cap!==null)void end('setup',cap)
    }
    const saveSetupDefaults=()=>{
        savePreferences(cloud?{...preferences,resolution,bitrate}:{...preferences,remoteResolution:resolution,remoteBitrate:bitrate,consolePaired})
        setDefaultsUpdated(true)
    }
    const rememberCurrentSetup=()=>{
        rememberSetup(target.type,{resolution,bitrate,profile,vibration,touch,keyboard,multipleControllers,consolePaired,volume,showStats,filters})
        setSetupMessage('Setup remembered for this sign-in only.')
    }
    const restoreDeviceDefaults=()=>{
        const next=deviceWebSetup(target.type,preferences)
        setResolution(next.resolution);setBitrate(next.bitrate);setConsolePaired(next.consolePaired);setMultipleControllers(next.multipleControllers)
        setVolume(next.volume);setShowStats(next.showStats);setFilters(next.filters);setProfile(next.profile);setVibration(next.vibration);setTouch(next.touch);setKeyboard(next.keyboard)
        setPreset(preferences.deadzone!==null||preferences.invertY!==null||preferences.swapSticks!==null||preferences.buttonMapping!==null?'custom':preferences.preset)
        setMuted(preferences.muted);setAdvancedOpen(false);setDefaultsUpdated(false);forgetSetup(target.type);setSetupMessage('Device defaults restored for this mode.')
    }
    const button='v3-button v3-button-secondary'
    return <main className="v3-session" ref={setupScope}>
        <Head><title>{target.name} · Greenlight V3</title></Head>
        <DashboardInput enabled={phase==='idle'} scope={setupScope} keyboardNavigation={false} onBack={leaveSetup}/>
        <header className="v3-page-header v3-session-header">
            <div><p>{mode}</p><h1>{target.name}</h1></div>
            {phase==='idle'&&<button type="button" className={button} onClick={()=>void end()}><ArrowLeft size={17} aria-hidden="true"/> Back to {cloud?'library':'consoles'}</button>}
        </header>
        {phase==='idle'&&leaveRequested&&captureRetained&&<section className="v3-panel" role="alert"><p>Leaving this game page discards its local captures. Save them below before leaving.</p><div className="v3-actions"><button type="button" className={button} onClick={()=>setLeaveRequested(false)}>Stay here</button><button type="button" className={button} onClick={onExit}>Discard captures and leave</button></div></section>}
        {phase==='idle'&&<div className="v3-panel v3-settings-panel v3-session-setup">
            <h2>Stream setup</h2>
            <div className="v3-settings-grid">
                <label className="v3-setting">Resolution <select className="v3-field" value={resolution} onChange={event=>setResolution(event.target.value==='720'?720:1080)}><option value="720">720p</option><option value="1080">1080p</option></select></label>
                <label className="v3-setting">Requested bitrate <select className="v3-field" value={bitrate} onChange={event=>{const value=parseSessionBitrate(event.target.value);if(value!==null)setBitrate(value)}}>{sessionBitrates.map(cap=><option key={cap} value={cap}>{sessionBitrateLabel(cap,'Automatic')}</option>)}</select></label>
            </div>
            {!cloud&&<label className="flex items-center gap-2"><input type="checkbox" checked={consolePaired} onChange={event=>{setConsolePaired(event.target.checked);if(event.target.checked)setAdvancedOpen(false)}}/> Controller connected directly to Xbox</label>}
            {!inputOptions.consoleController&&<label className="flex items-center gap-2"><input type="checkbox" checked={multipleControllers} onChange={event=>setMultipleControllers(event.target.checked)}/> Multiple local controllers (experimental)</label>}
            {!inputOptions.consoleController&&<label className="flex items-center gap-2"><input type="checkbox" checked={keyboard} onChange={event=>setKeyboard(event.target.checked)}/> Keyboard controller emulation</label>}
            {!inputOptions.consoleController&&<label className="v3-setting">Touch input <select className="v3-field" value={touch} onChange={event=>{const value=event.target.value;setTouch(value==='direct'||value==='controller'?value:'off')}}><option value="off">Off</option><option value="controller">On-screen controller</option><option value="direct">Direct touch (experimental)</option></select></label>}
            {!inputOptions.consoleController&&<details className="w-full rounded border border-white/10 p-3" onToggle={event=>{if(event.target===event.currentTarget)setAdvancedOpen(event.currentTarget.open)}}><summary className="cursor-pointer">Advanced physical controller options</summary><div className="flex flex-wrap gap-3 mt-3 items-center">
                <label>Preset <select className="bg-[#202020] rounded p-2" value={preset} onChange={event=>{if(event.target.value==='custom')return;setProfile(selectWebControllerPreset(event.target.value));setPreset(event.target.value)}}>{Object.entries(webControllerPresets).map(([id,item])=><option key={id} value={id}>{item.name}</option>)}{preset==='custom'&&<option value="custom">Custom</option>}</select></label>
                <label>Stick deadzone: {Math.round(profile.v3_deadzone*100)}% <input type="range" min="0" max="50" step="1" value={Math.round(profile.v3_deadzone*100)} onChange={event=>{const value=parseWebDeadzone(event.target.value);if(value!==null){setProfile(previous=>({...previous,v3_deadzone:value}));setPreset('custom')}}}/></label>
                <label><input type="checkbox" checked={profile.v3_invert_y} onChange={event=>{setProfile(previous=>({...previous,v3_invert_y:event.target.checked}));setPreset('custom')}}/> Invert Y axes</label>
                <label><input type="checkbox" checked={profile.v3_swap_sticks} onChange={event=>{setProfile(previous=>({...previous,v3_swap_sticks:event.target.checked}));setPreset('custom')}}/> Swap sticks</label>
                <label><input type="checkbox" checked={vibration} onChange={event=>setVibration(event.target.checked)}/> Controller vibration</label>
                <button type="button" className={button} onClick={()=>{setProfile(selectWebControllerPreset('standard'));setPreset('standard');setVibration(true)}}>Reset controller options</button>
                {advancedOpen&&<ControllerBindings mapping={profile.v3_button_mapping} onChange={mapping=>{setProfile(previous=>({...previous,v3_button_mapping:mapping}));setPreset('custom')}}/>}
                <p className="w-full text-sm text-white/60">These options apply to local physical controllers for this session. Vibration requires compatible browser and hardware support.</p>
            </div></details>}
            <p className="v3-muted">Xbox and your connection determine the actual stream quality.</p>
            {!inputOptions.consoleController&&<ControllerCalibration deadzone={profile.v3_deadzone} onApply={value=>{setProfile(previous=>({...previous,v3_deadzone:value}));setPreset('custom')}}/>}
            <div className="v3-actions">
                <button type="button" className="v3-button v3-button-primary" onClick={start}><Play size={17} aria-hidden="true"/> Start {mode}</button>
                <button type="button" className={button} onClick={saveSetupDefaults}>Save stream defaults</button>
            </div>
            <div className="v3-actions">
                <button type="button" className={button} onClick={rememberCurrentSetup}>Remember setup for this sign-in</button>
                <button type="button" className={button} onClick={restoreDeviceDefaults}>Restore device defaults</button>
            </div>
            <p className="v3-muted">Remembered setups override device defaults for this mode until sign-out, account switch or reload. Microphone and mute are not saved here.</p>
            {setupMessage&&<p role="status">{setupMessage}</p>}
            {defaultsUpdated&&<p className="v3-muted" role="status">{storageAvailable?'Defaults updated for '+mode+'.':'Defaults updated for this window. Storage is unavailable.'}</p>}
        </div>}
        {cloud&&phase!=='idle'&&<p className="text-sm text-white/60">Cloud queues may take several minutes. Cancelling will request termination of the current session; starting again may rejoin the queue.</p>}
        {phase==='starting'&&<p role="status">Starting Xbox session…</p>}
        {phase==='playing'&&<p role="status">{status==='Error'?(handshakeFailureMessage[failureReason]??'Connection failed. End the session before trying again.'):status}</p>}
        {phase==='startFailed'&&<section className="v3-panel v3-start-failure">
            <div role="alert"><h2>Couldn’t start {mode}</h2><p>{startFailureDetails[startupFailure].message}</p></div>
            <div className="v3-actions">
                <button type="button" className={button} onClick={()=>void end()}>Back to {cloud?'library':'consoles'}</button>
                {startFailureDetails[startupFailure].canReturnToSetup&&<button type="button" className={button} onClick={()=>void end('setup')}>Back to stream setup</button>}
            </div>
        </section>}
        {phase==='stopping'&&<p role="status">Waiting for Xbox to acknowledge session termination…</p>}
        {phase==='stopFailed'&&<p role="alert">Xbox termination is not confirmed. A previous request may still be pending. Retry before leaving.</p>}
        {phase==='playing'&&adapter&&status!=='Error'&&<FullscreenSurface enabled={status==='Connected'} fullscreenActions={<>
            <button type="button" className={button} aria-pressed={muted} onClick={event=>{event.currentTarget.blur();setMuted(value=>!value)}}>{muted?'Unmute':'Mute'}</button>
            {micAvailable&&adapter.sendChatSDP&&<button type="button" className={button} aria-pressed={microphoneRequested(mic)} onClick={event=>{event.currentTarget.blur();setMic(previous=>toggleWebMicrophone(previous,micAvailable,phaseRef.current==='playing'&&status==='Connected'))}}>{mic==='active'?'Disable microphone':mic==='requesting'?'Cancel microphone request':'Enable microphone'}</button>}
            {!inputOptions.consoleController&&<button type="button" className={button} onClick={event=>{event.currentTarget.blur();setGuideMissing(false);setGuide(value=>value+1)}}>Xbox guide</button>}
            <button type="button" className={button} aria-pressed={showStats} onClick={event=>{event.currentTarget.blur();setShowStats(value=>!value)}}>Statistics</button>
            <button type="button" className={button} onClick={event=>{event.currentTarget.blur();setKeyframe(value=>value+1)}}>Refresh video</button>
            <button type="button" className={button} onClick={()=>void end('setup')}>End and return to setup</button>
            {mic==='active'&&<p role="status" className="w-full text-center">Microphone active</p>}
            {mic==='requesting'&&<p role="status" className="w-full text-center">Requesting microphone…</p>}
            {mic==='failed'&&<p role="alert" className="w-full text-center">Microphone unavailable</p>}
            {guideMissing&&<p role="status" className="w-full text-center">Enable a local controller to open the guide.</p>}
        </>}>
            <div ref={playerSurface} className="web-remote-player" style={{'--gl-web-video-filter':presentation.filter} as CSSProperties}>
                {presentation.kernel&&<svg width="0" height="0" aria-hidden="true" style={{position:'absolute',pointerEvents:'none'}}><defs><filter id="gl-stream-sharpen" colorInterpolationFilters="sRGB"><feConvolveMatrix order={3} kernelMatrix={presentation.kernel} divisor={1} edgeMode="duplicate" preserveAlpha={true}/></filter></defs></svg>}
                <SharedPlayer
                    communicationHandler={adapter}
                    onStatusChanged={value=>{
                        if(phaseRef.current!=='playing')return
                        setStatus(value)
                        if(value!=='Connected'){captureSession.current?.suspendLiveCapture();setMic('off')}
                    }}
                    useWebGpu={false}
                    {...inputOptions}
                    {...controllerOptions}
                    videoBitrate={bitrate}
                    volume={volume}
                    muted={muted}
                    microphone={micAvailable&&status==='Connected'&&microphoneRequested(mic)}
                    onMicrophoneStatus={(active,error)=>{if(phaseRef.current==='playing')setMic(previous=>webMicrophoneResult(previous,active,error))}}
                    showStats={showStats}
                    onMetrics={metrics=>{
                        if(!mounted.current||phaseRef.current!=='playing')return
                        const elapsed=(performance.now()-diagnosticStart.current)/1000
                        setSamples(previous=>appendWebDiagnostic(previous,metrics,elapsed))
                    }}
                    onFailureReason={reason=>{if(mounted.current&&phaseRef.current==='playing')setFailureReason(reason)}}
                    keyframeRequest={keyframe}
                    guideRequest={guide}
                    onGuideUnavailable={()=>setGuideMissing(true)}
                />
            </div>
        </FullscreenSurface>}
        {phase==='playing'&&status==='Connected'&&<div className="flex flex-wrap gap-3 my-3">
            {!inputOptions.consoleController&&<><label>Touch input <select className="bg-[#202020] rounded p-2" value={touch} onChange={event=>{const value=event.target.value;setTouch(value==='direct'||value==='controller'?value:'off');setGuideMissing(false)}}><option value="off">Off</option><option value="controller">On-screen controller</option><option value="direct">Direct touch (experimental)</option></select></label><button type="button" className={button} aria-pressed={keyboard} onClick={()=>{setKeyboard(value=>!value);setGuideMissing(false)}}>Keyboard controller</button></>}
            <button type="button" className={button} aria-pressed={muted} onClick={()=>setMuted(value=>!value)}>Mute</button>
            {micAvailable&&adapter?.sendChatSDP&&<button type="button" className={button} aria-pressed={microphoneRequested(mic)} onClick={()=>setMic(previous=>toggleWebMicrophone(previous,micAvailable,phaseRef.current==='playing'&&status==='Connected'))}>{mic==='requesting'?'Cancel microphone request':mic==='active'?'Disable microphone':'Enable microphone (experimental)'}</button>}
            <label>Volume: {Math.round(volume*100)}% <input type="range" min="0" max="100" step="1" value={Math.round(volume*100)} onChange={event=>{const value=parseWebVolume(event.target.value);if(value!==null)setVolume(value)}}/></label>
            <button type="button" className={button} aria-pressed={showStats} onClick={()=>setShowStats(value=>!value)}>Streaming statistics</button>
            {!inputOptions.consoleController&&<button type="button" className={button} onClick={()=>{setGuideMissing(false);setGuide(value=>value+1)}}>Xbox guide</button>}
            <button type="button" className={button} onClick={()=>setKeyframe(value=>value+1)}>Request video refresh</button>
        </div>}
        {phase==='playing'&&status==='Connected'&&<div className="text-sm text-white/60 my-2">
            {micAvailable?<p>Microphone chat is opt-in and requires browser permission and Xbox support. Playback mute does not mute your microphone. Hiding the page disables voice chat; enable it again when you return. Android Private V3 companion requires a compatible app build and explicit native microphone permission.</p>:<p>Microphone capture is unavailable in this browser or insecure context.</p>}
            {mic==='requesting'&&<p role="status">Requesting microphone permission and negotiating voice chat…</p>}
            {mic==='active'&&<p role="status" className="font-semibold text-white">Microphone active — your voice may be transmitted to Xbox.</p>}
            {mic==='failed'&&<p role="alert">Microphone unavailable or disconnected. Check permissions, device and Xbox chat support before retrying.</p>}
        </div>}
        {phase==='playing'&&status==='Connected'&&inputOptions.directTouch&&<p className="text-sm text-white/60">Direct touch requires compatible Xbox titles and is experimental. Switch to the on-screen controller for other games.</p>}
        {phase==='playing'&&status==='Connected'&&inputOptions.keyboardMapping&&<p className="text-sm text-white/60">Click the video to move focus away from controls. Arrow keys: D-pad · Enter/Backspace: A/B · X/Y: X/Y · M/V/N: Menu/View/Guide · [ / ]: shoulders · L/R: stick buttons · - / =: triggers.</p>}
        {phase==='playing'&&status==='Connected'&&<VideoAppearance value={filters} onChange={setFilters}/>}
        {phase==='playing'&&status==='Connected'&&<PictureInPictureControl surface={()=>playerSurface.current}/>}
        {phase==='playing'&&status==='Connected'&&<div className="my-2"><button type="button" className={button} onClick={rememberCurrentSetup}>Remember current setup for this sign-in</button>{setupMessage&&<p role="status">{setupMessage}</p>}</div>}
        <CaptureControls surface={()=>playerSurface.current} connected={phase==='playing'&&status==='Connected'} onRetainedChange={captureChanged} sessionRef={captureSession}/>
        {phase!=='idle'&&<StreamDiagnostics samples={samples} type={target.type} status={status} reason={failureReason} recommendedCap={advice} onApplyRecommendation={applyAdvice}/>}
        {guideMissing&&<p role='status'>Connect a controller or enable the on-screen or keyboard controller to open the guide.</p>}
        {phase!=='idle'&&phase!=='startFailed'&&<div className="v3-actions">
            <button type="button" className={button} disabled={phase==='stopping'} onClick={()=>void end(phase==='stopFailed'?exitDestination.current:'browse')}>{phase==='stopFailed'?'Retry ending session':phase==='starting'?'Cancel and end session':'End session'}</button>
            {phase==='playing'&&<button type="button" className={button} onClick={()=>void end('setup')}>End stream and return to setup</button>}
        </div>}
    </main>
}
