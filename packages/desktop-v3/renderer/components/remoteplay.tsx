import React,{useEffect,useRef,useState} from 'react'
import dynamic from 'next/dynamic'
import {useAuth} from '../contexts/AuthContext'
import {useTRPCClient} from '../utils/trpc'
import {createRemoteSession,defaultStreamOrigin} from '../utils/remotesession'
import {SessionLifecycle} from '../../../desktop/renderer/lib/sessionlifecycle'
import type {communicationHandler} from '../../../player/src/client/index'
import type {ConsoleSummary} from '../utils/consoles'

const SharedPlayer=dynamic(()=>import('../../../player/src/client/index').then(module=>module.StreamPlayer),{ssr:false})
type Phase='idle'|'starting'|'playing'|'startFailed'|'stopping'|'stopFailed'
export default function RemotePlay({console:device,onExit}:{console:ConsoleSummary;onExit:()=>void}){
    const {getxHomeToken,getUserRefreshToken,authState}=useAuth()
    const client=useTRPCClient()
    const lifecycle=useRef(new SessionLifecycle())
    const mounted=useRef(false)
    const phaseRef=useRef<Phase>('idle')
    const [phase,setPhase]=useState<Phase>('idle')
    const [status,setStatus]=useState('Initializing')
    const [adapter,setAdapter]=useState<communicationHandler|null>(null)
    const [resolution,setResolution]=useState<720|1080>(1080)
    const [muted,setMuted]=useState(false)
    const [touch,setTouch]=useState(false)
    const [guide,setGuide]=useState(0)
    const [guideMissing,setGuideMissing]=useState(false)
    const transition=(value:Phase)=>{phaseRef.current=value;if(mounted.current)setPhase(value)}
    useEffect(()=>{
        mounted.current=true
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
        try{
            const token=getxHomeToken()
            const refresh=getUserRefreshToken()
            const host=defaultStreamOrigin(authState?.streamingTokens?.xHomeToken?.data.offeringSettings?.regions)
            const remote=createRemoteSession({
                start:input=>client.streaming_start_stream.mutate(input),
                stop:input=>client.streaming_stop_stream.mutate(input),
                status:input=>client.streaming_get_status.mutate(input),
                sdp:input=>client.streaming_send_sdp_offer.mutate(input),
                ice:input=>client.streaming_send_ice_candidates.mutate(input),
                connect:input=>client.streaming_send_msal_token.mutate(input),
                keepalive:input=>client.streaming_send_keepalive.mutate(input),
            },{id:device.id,type:'home',host,language:token.language,resolution},token,refresh||'')
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
    const end=async()=>{
        if(phaseRef.current==='stopping')return
        if(phaseRef.current==='idle'){onExit();return}
        transition('stopping');setAdapter(null)
        const stopped=await lifecycle.current.end()
        if(!mounted.current)return
        if(stopped){transition('idle');onExit()}
        else transition('stopFailed')
    }
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    return <section className="h-screen overflow-y-auto bg-[#0d0d0d] text-white p-4">
        <h1 className="text-2xl font-bold break-words">{device.name} — Experimental Remote Play</h1>
        <p className="text-sm text-white/60 my-2">Use a trusted private experimental backend. End the stream before leaving; closing the browser cannot guarantee remote cleanup.</p>
        {phase==='idle'&&<div className="flex flex-wrap gap-3 my-4">
            <label>Resolution <select className="bg-[#202020] rounded p-2" value={resolution} onChange={event=>setResolution(event.target.value==='720'?720:1080)}><option value="720">720p</option><option value="1080">1080p</option></select></label>
            <button type="button" className={button} onClick={start}>Start Remote Play</button>
            <button type="button" className={button} onClick={()=>void end()}>Back to consoles</button>
        </div>}
        {phase==='starting'&&<p role="status">Starting Xbox session…</p>}
        {phase==='playing'&&<p role="status">{status==='Error'?'Connection failed. End the session before trying again.':status}</p>}
        {phase==='startFailed'&&<p role="alert">Unable to start. If the provisioning response was lost, check your Xbox before retrying.</p>}
        {phase==='stopping'&&<p role="status">Waiting for Xbox to acknowledge session termination…</p>}
        {phase==='stopFailed'&&<p role="alert">Xbox did not acknowledge termination. Retry before leaving.</p>}
        {phase==='playing'&&adapter&&status!=='Error'&&<div className="web-remote-player"><SharedPlayer communicationHandler={adapter} onStatusChanged={setStatus} useWebGpu={false} autoGamepad multiController touchControls={touch} muted={muted} showStats guideRequest={guide} onGuideUnavailable={()=>setGuideMissing(true)}/></div>}
        {phase==='playing'&&status==='Connected'&&<div className="flex flex-wrap gap-3 my-3">
            <button type="button" className={button} aria-pressed={touch} onClick={()=>setTouch(value=>!value)}>Touch controller</button>
            <button type="button" className={button} aria-pressed={muted} onClick={()=>setMuted(value=>!value)}>Mute</button>
            <button type="button" className={button} onClick={()=>{setGuideMissing(false);setGuide(value=>value+1)}} >Xbox guide</button>
        </div>}
        {guideMissing&&<p role='status'>Connect a controller or enable touch controls to open the guide.</p>}
        {phase!=='idle'&&<button type="button" className={button} disabled={phase==='stopping'} onClick={()=>void end()}>{phase==='stopFailed'?'Retry ending session':phase==='starting'?'Cancel and end session':'End session'}</button>}
    </section>
}
