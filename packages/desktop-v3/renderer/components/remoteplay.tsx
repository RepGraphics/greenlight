import {useEffect,useRef,useState,type CSSProperties} from 'react'
import dynamic from 'next/dynamic'
import CaptureControls from './capturecontrols'
import FullscreenSurface from './fullscreensurface'
import StreamDiagnostics from './streamdiagnostics'
import {webQualityAdvice} from '../utils/webqualityadvice'
import {appendWebDiagnostic} from '../utils/webdiagnostics'
import type {DiagnosticSample} from '../../../desktop/renderer/lib/streamdiagnostics'
import ControllerCalibration from './controllercalibration'
import PictureInPictureControl from './pictureinpicturecontrol'
import VideoAppearance from './videoappearance'
import {webVideoPresentation} from '../utils/videoappearance'
import {snapshotWebSetup} from '../utils/websetuppresets'
import {useAuth} from '../contexts/AuthContext'
import {useTRPCClient} from '../utils/trpc'
import {createRemoteSession,selectStreamCredentials,type WebStreamTarget} from '../utils/remotesession'
import {SessionLifecycle} from '../../../desktop/renderer/lib/sessionlifecycle'
import {parseSessionBitrate,sessionBitrates,sessionBitrateLabel} from '../../../desktop/renderer/lib/sessionquality'
import {webSessionInputOptions,type WebTouchMode} from '../utils/sessionoptions'
import ControllerBindings from './controllerbindings'
import {webControllerPresets,selectWebControllerPreset,parseWebDeadzone,parseWebVolume,webControllerOptions} from '../utils/controlleroptions'
import {webMicrophoneSupported,microphoneRequested,toggleWebMicrophone,webMicrophoneResult,type WebMicrophoneState} from '../utils/microphoneoptions'
import type {communicationHandler} from '@greenlight/player/client'

const SharedPlayer=dynamic(()=>import('@greenlight/player/client').then(module=>module.StreamPlayer),{ssr:false})
type Phase='idle'|'starting'|'playing'|'startFailed'|'stopping'|'stopFailed'
export default function RemotePlay({target,onExit}:{target:WebStreamTarget;onExit:()=>void}){
    const {getxHomeToken,getxCloudToken,getUserRefreshToken,authState,setupPresets,rememberSetup,forgetSetup}=useAuth()
    const saved=setupPresets[target.type]
    const [initial]=useState(()=>snapshotWebSetup(target.type,saved))
    const cloud=target.type==='cloud'
    const mode=cloud?'Cloud Gaming':'Remote Play'
    const client=useTRPCClient()
    const lifecycle=useRef(new SessionLifecycle())
    const playerSurface=useRef<HTMLDivElement|null>(null)
    const mounted=useRef(false)
    const phaseRef=useRef<Phase>('idle')
    const [phase,setPhase]=useState<Phase>('idle')
    const [status,setStatus]=useState('Initializing')
    const [samples,setSamples]=useState<DiagnosticSample[]>([])
    const [failureReason,setFailureReason]=useState('')
    const diagnosticStart=useRef(0)
    const [adapter,setAdapter]=useState<communicationHandler|null>(null)
    const [resolution,setResolution]=useState<720|1080>(initial.resolution)
    const [bitrate,setBitrate]=useState(initial.bitrate)
    const [consolePaired,setConsolePaired]=useState(initial.consolePaired)
    const [multipleControllers,setMultipleControllers]=useState(initial.multipleControllers)
    const [keyframe,setKeyframe]=useState(0)
    const [muted,setMuted]=useState(false)
    const [micAvailable,setMicAvailable]=useState(false)
    const [mic,setMic]=useState<WebMicrophoneState>('off')
    const [volume,setVolume]=useState(initial.volume)
    const [showStats,setShowStats]=useState(initial.showStats)
    const [filters,setFilters]=useState(initial.filters)
    const presentation=webVideoPresentation(filters)
    const [profile,setProfile]=useState(()=>saved?initial.profile:selectWebControllerPreset('standard'))
    const [preset,setPreset]=useState(saved?'custom':'standard')
    const [advancedOpen,setAdvancedOpen]=useState(false)
    const [vibration,setVibration]=useState(initial.vibration)
    const [touch,setTouch]=useState<WebTouchMode>(initial.touch)
    const [keyboard,setKeyboard]=useState(initial.keyboard)
    const inputOptions=webSessionInputOptions(target.type,consolePaired,multipleControllers,touch,keyboard)
    const controllerOptions=webControllerOptions(profile,vibration,inputOptions.consoleController)
    const [guide,setGuide]=useState(0)
    const [guideMissing,setGuideMissing]=useState(false)
    const [setupMessage,setSetupMessage]=useState('')
    const transition=(value:Phase)=>{phaseRef.current=value;if(mounted.current)setPhase(value)}
    useEffect(()=>{
        mounted.current=true
        setMicAvailable(webMicrophoneSupported(window.isSecureContext,navigator.mediaDevices))
        const warn=(event:BeforeUnloadEvent)=>{
            if(phaseRef.current==='idle')return
            event.preventDefault();event.returnValue=''
        }
        window.addEventListener('beforeunload',warn)
        return()=>{
            mounted.current=false
            window.removeEventListener('beforeunload',warn)
            if(phaseRef.current!=='idle')void lifecycle.current.end()
        }
    },[])
    const start=()=>{
        if(phaseRef.current!=='idle')return
        diagnosticStart.current=performance.now();setSamples([]);setFailureReason('')
        try{
            const {token,host}=selectStreamCredentials(target,getxHomeToken(),getxCloudToken(),{
                home:authState?.streamingTokens?.xHomeToken?.data.offeringSettings?.regions,
                cloud:authState?.streamingTokens?.xCloudToken?.data.offeringSettings?.regions,
            })
            const refresh=getUserRefreshToken()
            const remote=createRemoteSession({
                start:input=>client.streaming_start_stream.mutate(input),
                stop:input=>client.streaming_stop_stream.mutate(input),
                status:input=>client.streaming_get_status.mutate(input),
                sdp:input=>client.streaming_send_sdp_offer.mutate(input),
                chat:input=>client.streaming_send_chat_sdp.mutate({...input,offer:{type:'offer',sdp:input.offer.sdp??''}}),
                ice:input=>client.streaming_send_ice_candidates.mutate(input),
                connect:input=>client.streaming_send_msal_token.mutate(input),
                keepalive:input=>client.streaming_send_keepalive.mutate(input),
            },{id:target.id,type:target.type,host,language:token.language,resolution},token,refresh||'',message=>{
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
                onError:reason=>transition(reason==='stop'?'stopFailed':'startFailed'),
            })
        }catch{transition('startFailed')}
    }
    const end=async(returnToSetup=false,nextBitrate?:number)=>{
        if(phaseRef.current==='stopping')return
        if(phaseRef.current==='idle'){onExit();return}
        transition('stopping');setMic('off');setAdapter(null)
        const stopped=await lifecycle.current.end()
        if(!mounted.current)return
        if(stopped){
            transition('idle');setStatus('Initializing');setGuideMissing(false)
            if(returnToSetup){if(nextBitrate!==undefined)setBitrate(nextBitrate)}
            else onExit()
        }else transition('stopFailed')
    }
    const advice=phase==='playing'&&status==='Connected'?webQualityAdvice(samples,bitrate,Math.max(0,(typeof performance==='undefined'?0:performance.now())-diagnosticStart.current)/1000,status):null
    const applyAdvice=()=>{
        if(phaseRef.current!=='playing'||status!=='Connected')return
        const cap=webQualityAdvice(samples,bitrate,(performance.now()-diagnosticStart.current)/1000,status)
        if(cap!==null)void end(true,cap)
    }
    const remember=()=>{
        rememberSetup(target.type,{resolution,bitrate,profile,vibration,touch,keyboard,multipleControllers,consolePaired,volume,showStats,filters})
        setSetupMessage('Setup remembered for this sign-in.')
    }
    const resetSetup=()=>{
        const next=snapshotWebSetup(target.type,null)
        setResolution(next.resolution);setBitrate(next.bitrate);setProfile(selectWebControllerPreset('standard'));setPreset('standard')
        setVibration(next.vibration);setTouch(next.touch);setKeyboard(next.keyboard);setMultipleControllers(next.multipleControllers)
        setConsolePaired(next.consolePaired);setVolume(next.volume);setShowStats(next.showStats);setFilters(next.filters);setMuted(false)
        forgetSetup(target.type);setSetupMessage('Setup defaults restored and remembered preset cleared.')
    }
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    return <section className="h-screen overflow-y-auto bg-[#0d0d0d] text-white p-4">
        <h1 className="text-2xl font-bold break-words">{target.name} — Experimental {mode}</h1>
        <p className="text-sm text-white/60 my-2">Use a trusted private experimental backend. End the stream before leaving; closing the browser cannot guarantee remote cleanup.</p>
        {phase==='idle'&&<div className="flex flex-wrap gap-3 my-4">
            <label>Resolution <select className="bg-[#202020] rounded p-2" value={resolution} onChange={event=>setResolution(event.target.value==='720'?720:1080)}><option value="720">720p</option><option value="1080">1080p</option></select></label>
            <label>Requested bitrate <select className="bg-[#202020] rounded p-2" value={bitrate} onChange={event=>{const value=parseSessionBitrate(event.target.value);if(value!==null)setBitrate(value)}}>{sessionBitrates.map(cap=><option key={cap} value={cap}>{sessionBitrateLabel(cap,'Automatic')}</option>)}</select></label>
            {!cloud&&<label className="flex items-center gap-2"><input type="checkbox" checked={consolePaired} onChange={event=>{setConsolePaired(event.target.checked);if(event.target.checked){setTouch('off');setKeyboard(false);setAdvancedOpen(false)}}}/> Controller connected directly to Xbox</label>}
            {!inputOptions.consoleController&&<label className="flex items-center gap-2"><input type="checkbox" checked={multipleControllers} onChange={event=>setMultipleControllers(event.target.checked)}/> Multiple local controllers (experimental)</label>}
            {!inputOptions.consoleController&&<label>Touch input <select className="bg-[#202020] rounded p-2" value={touch} onChange={event=>{const value=event.target.value;setTouch(value==='controller'||value==='direct'?value:'off')}}><option value="off">Off</option><option value="controller">On-screen controller</option><option value="direct">Direct touch (experimental)</option></select></label>}
            {!inputOptions.consoleController&&<label className="flex items-center gap-2"><input type="checkbox" checked={keyboard} onChange={event=>setKeyboard(event.target.checked)}/> Keyboard controller emulation</label>}
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
            <p className="w-full text-sm text-white/60">Resolution and bitrate are requested at connection time, not guaranteed or adjusted live. Local multiplayer depends on Xbox service and game support.</p>
            {!inputOptions.consoleController&&<ControllerCalibration deadzone={profile.v3_deadzone} onApply={value=>{setProfile(previous=>({...previous,v3_deadzone:value}));setPreset('custom')}}/>}
            <div className="w-full rounded border border-white/10 p-3 flex flex-wrap gap-2 items-center">
                <p className="w-full text-sm text-white/60">Remember quality, controller, touch and display settings separately for Remote Play and Cloud Gaming until sign-out or reload. Microphone permission, playback mute and captures are never remembered.</p>
                <button type="button" className={button} onClick={remember}>Remember setup for this sign-in</button>
                <button type="button" className={button} onClick={resetSetup}>Restore defaults and forget setup</button>
                {setupMessage&&<p role="status">{setupMessage}</p>}
            </div>
            <button type="button" className={button} onClick={start}>Start {mode}</button>
            <button type="button" className={button} onClick={()=>void end()}>Back to {cloud?'library':'consoles'}</button>
        </div>}
        {cloud&&phase!=='idle'&&<p className="text-sm text-white/60">Cloud queues may take several minutes. Cancelling will request termination of the current session; starting again may rejoin the queue.</p>}
        {phase==='starting'&&<p role="status">Starting Xbox session…</p>}
        {phase==='playing'&&<p role="status">{status==='Error'?'Connection failed. End the session and return to setup before trying again.':status}</p>}
        {phase==='startFailed'&&<p role="alert">Unable to start. If the provisioning response was lost, check for an existing Xbox session before retrying.</p>}
        {phase==='stopping'&&<p role="status">Waiting for Xbox to acknowledge session termination…</p>}
        {phase==='stopFailed'&&<p role="alert">Xbox termination is not confirmed. A previous request may still be pending. Retry before leaving.</p>}
        {phase==='playing'&&adapter&&status!=='Error'&&<FullscreenSurface enabled={status==='Connected'}>
            <div ref={playerSurface} className="web-remote-player" style={{'--gl-web-video-filter':presentation.filter} as CSSProperties}>
                {presentation.kernel&&<svg width="0" height="0" aria-hidden="true" style={{position:'absolute',pointerEvents:'none'}}><defs><filter id="gl-stream-sharpen" colorInterpolationFilters="sRGB"><feConvolveMatrix order={3} kernelMatrix={presentation.kernel} divisor={1} edgeMode="duplicate" preserveAlpha={true}/></filter></defs></svg>}
                <SharedPlayer
                    communicationHandler={adapter}
                    onStatusChanged={value=>{
                        if(phaseRef.current!=='playing')return
                        setStatus(value)
                        if(value!=='Connected')setMic('off')
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
            {micAvailable?<p>Microphone chat is opt-in and requires browser permission and Xbox support. Playback mute does not mute your microphone. Android companion voice chat requires a compatible app build and native permission.</p>:<p>Microphone capture is unavailable in this browser or insecure context.</p>}
            {mic==='requesting'&&<p role="status">Requesting microphone permission and negotiating voice chat…</p>}
            {mic==='active'&&<p role="status" className="font-semibold text-white">Microphone active — your voice may be transmitted to Xbox.</p>}
            {mic==='failed'&&<p role="alert">Microphone unavailable or disconnected. Check permissions, device and Xbox chat support before retrying.</p>}
        </div>}
        {phase==='playing'&&status==='Connected'&&inputOptions.directTouch&&<p className="text-sm text-white/60">Direct touch requires compatible Xbox titles and is experimental. Switch to the on-screen controller for other games.</p>}
        {phase==='playing'&&status==='Connected'&&inputOptions.keyboardMapping&&<p className="text-sm text-white/60">Click the video to move focus away from controls. Arrow keys: D-pad · Enter/Backspace: A/B · X/Y: X/Y · M/V/N: Menu/View/Guide · [ / ]: shoulders · L/R: stick buttons · - / =: triggers.</p>}
        {phase==='playing'&&status==='Connected'&&<VideoAppearance value={filters} onChange={setFilters}/>}
        {phase==='playing'&&status==='Connected'&&<PictureInPictureControl surface={()=>playerSurface.current}/>}
        {phase==='playing'&&status==='Connected'&&<div className="my-2"><button type="button" className={button} onClick={remember}>Remember current setup for this sign-in</button>{setupMessage&&<p role="status">{setupMessage}</p>}</div>}
        {phase==='playing'&&status==='Connected'&&<CaptureControls surface={()=>playerSurface.current}/>}
        {phase!=='idle'&&<StreamDiagnostics samples={samples} type={target.type} status={status} reason={failureReason} recommendedCap={advice} onApplyRecommendation={applyAdvice}/>}
        {guideMissing&&<p role='status'>Connect a controller or enable the on-screen or keyboard controller to open the guide.</p>}
        {(phase==='playing'||phase==='startFailed'||phase==='stopFailed')&&<button type="button" className={button+' mr-2'} onClick={()=>void end(true)}>{phase==='stopFailed'?'Retry ending and return to setup':'End stream and return to setup'}</button>}
        {phase!=='idle'&&<button type="button" className={button} disabled={phase==='stopping'} onClick={()=>void end()}>{phase==='stopFailed'?'Retry ending session':phase==='starting'?'Cancel and end session':'End session'}</button>}
    </section>
}
