import React from 'react'
import { addSession,makeSessionRecord } from '../../lib/sessionhistory'
import { recoveryBitrate } from '../../lib/bitrateadvisor'
import {downloadDiagnostics} from '../../lib/streamdiagnostics'
import type { DiagnosticSample } from '../../lib/streamdiagnostics'
import { ManualReconnect, ClassicRecoveryBudget } from '../../lib/sessionrecovery'
import { SessionLifecycle } from '../../lib/sessionlifecycle'
import { startHeartbeat } from '../../lib/keepalive'
import { watchClassicConnection } from '../../lib/classicconnection'
import { ClassicStatsWatchdog } from '../../lib/classicstatswatchdog'
import { useStreamAwake } from '../../lib/useStreamAwake'
import { useDiscordPresence } from '../../lib/useDiscordPresence'
import { configureClassicConsoleController } from '../../lib/classicconsolecontroller'
import { configureClassicControllerProfile,resolveClassicControllerProfile } from '../../lib/classiccontrollerprofile'
import { readConsoleProfiles } from '../../lib/consoleprofiles'
import { readGameProfiles } from '../../lib/gameprofiles'
import ExperimentalStream from '../../components/ui/experimentalstream'
import Head from 'next/head'
import { useRouter } from 'next/router'
import xCloudPlayer from 'xbox-xcloud-player'

import { useSettings } from '../../context/userContext'
import StreamComponent from '../../components/ui/streamcomponent'
import ClassicTouchControls from '../../components/ui/classictouchcontrols'
import { classicVirtualPad } from '../../lib/classicinputlifecycle'
import StreamPreload from '../../components/ui/streampreload'
import Ipc from '../../lib/ipc'
import { useTranslation } from 'react-i18next'

function LegacyStream({onRetry,recovery,lifecycle}:{onRetry:()=>void;recovery:ClassicRecoveryBudget;lifecycle:SessionLifecycle}) {
    const router = useRouter()
    const { settings: globalSettings } = useSettings()
    const target = typeof router.query.serverid === 'string' ? router.query.serverid : ''
    const profile = target.startsWith('xcloud_') ? readGameProfiles(globalSettings.v3_game_profiles).find(item => item.titleId === target.slice(7)) : undefined
    const consoleProfile = !target.startsWith('xcloud_') ? readConsoleProfiles(globalSettings.console_profiles).find(item => item.consoleId === target) : undefined
    const settings = {...globalSettings, xhome_resolution:consoleProfile?.resolution ?? globalSettings.xhome_resolution, xcloud_resolution:profile?.resolution ?? globalSettings.xcloud_resolution, xcloud_bitrate:profile?.bitrate ?? globalSettings.xcloud_bitrate, xhome_bitrate:consoleProfile?.bitrate ?? globalSettings.xhome_bitrate}
    const activeCap=recovery.bitrateOverride??(target.startsWith('xcloud_')?settings.xcloud_bitrate:settings.xhome_bitrate)
    const { t } = useTranslation()
    const [consoleController] = React.useState(()=>!target.startsWith('xcloud_') && Boolean(globalSettings.v3_console_controller))

    const streamStateInterval = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined)
    const stopHeartbeat = React.useRef<(()=>void)|undefined>(undefined)

    const [xPlayer, setxPlayer] = React.useState(undefined)
    const [sessionId, setSessionId] = React.useState('')
    const [connected,setConnected]=React.useState(false)
    const [connectionError,setConnectionError]=React.useState('')
    const intentionalExit=React.useRef(false)
    const reconnect=React.useRef(new ManualReconnect())
    const [capturePending,setCapturePending]=React.useState(false)
    const [retrying,setRetrying]=React.useState(false)
    const [retryError,setRetryError]=React.useState(false)
    const [recoveryCancelled,setRecoveryCancelled]=React.useState(false)
    const cancelRecovery=React.useRef(false)
    const cancelAutomaticRecovery=()=>{cancelRecovery.current=true;setRecoveryCancelled(true)}
    const [queueTime, setQueueTime] = React.useState(0)
    const activeSession = React.useRef('')
    const exitBusy=React.useRef(false)
    const mounted=React.useRef(true)
    const [exiting,setExiting]=React.useState(false)
    const startupFailed=React.useRef(false)
    const statsWatchdog=React.useRef(new ClassicStatsWatchdog())
    const failStats=React.useRef<(()=>void)|undefined>(undefined)
    const history=React.useRef({startedAt:Date.now(),connectedAt:0,saved:false,samples:[] as DiagnosticSample[]})
    const historyEnabled=React.useRef(Boolean(settings.v3_session_history))
    const recordHistory=React.useCallback((outcome:'ended'|'failed'|'interrupted')=>{const value=history.current;if(!historyEnabled.current||value.saved||(!value.connectedAt&&outcome!=='failed'))return;value.saved=true;addSession(makeSessionRecord(value.startedAt,value.connectedAt,Date.now(),target.startsWith('xcloud_')?'cloud':'home',outcome,value.samples,'classic'))},[target])
    const recordClassicSample=React.useCallback((sample:DiagnosticSample)=>{
        const value=history.current
        if(value.saved||!value.connectedAt||intentionalExit.current||reconnect.current.busy)return
        value.samples.push({...sample,elapsedSeconds:Math.max(0,(Date.now()-value.startedAt)/1000)})
        if(value.samples.length>300)value.samples.shift()
        // Monitor advancing samples independently of the opt-in history setting.
        // Background windows and intentionally disabled video are not evidence of a stall.
        if(statsWatchdog.current.observe(sample.elapsedSeconds,sample.statsFresh,document.visibilityState==='visible'&&globalSettings.video_enabled!==false))failStats.current?.()
    },[globalSettings.video_enabled])
    const exportClassicDiagnostics=()=>downloadDiagnostics(history.current.samples,target.startsWith('xcloud_')?'cloud':'home',connectionError?'Error':connected?'Connected':'Initializing','video',recovery.previousAttempts,connectionError,'classic')
    useStreamAwake(sessionId,connected&&!connectionError&&!target.startsWith('xcloud_')&&Boolean(settings.stream_keep_awake))
    useDiscordPresence(sessionId,connected&&!connectionError&&settings.discord_presence_enabled===true,settings.discord_application_id)
    React.useEffect(() => {
        mounted.current=true
        return () => {
            mounted.current=false
            reconnect.current.dispose()
            recordHistory('interrupted')
        }
    }, [])

    // Own provisioning separately from the WebRTC/player effect. Its cleanup
    // must not run just because a session ID or player becomes available.
    React.useEffect(()=>{
        if(!router.isReady||!target||intentionalExit.current)return
        const cloud=target.startsWith('xcloud_')
        return lifecycle.begin({
            start:()=>Ipc.send('streaming','startStream',{type:cloud?'cloud':'home',resolution:cloud?settings.xcloud_resolution:settings.xhome_resolution,target:cloud?target.slice(7):target}),
            stop:id=>Ipc.send('streaming','stopStream',{sessionId:id}),
            onSession:id=>{
                if(intentionalExit.current)return
                activeSession.current=id;setSessionId(id)
            },
            onError:reason=>{
                if(intentionalExit.current)return
                startupFailed.current=true
                if(reason==='stop')setRetryError(true)
                recordHistory('failed');setConnectionError('start')
            }
        })
    },[router.isReady,target,lifecycle])

    React.useEffect(() => {
        if (!router.isReady || typeof router.query.serverid !== 'string' || !sessionId) return
        let cancelled = false
        let polling = false
        let disposeConnection: (()=>void)|undefined
        // Detect stream type and title / server id
        let streamType = 'home'
        let serverId = router.query.serverid
        if((router.query.serverid as string).substr(0, 6) === 'xcloud'){
            streamType = 'cloud'
            serverId = (router.query.serverid as string).substr(7)
        }

        if(xPlayer !== undefined){
            const holder = document.getElementById('streamComponentHolder')
            if (!holder) return
            const surface = document.createElement('div')
            surface.id = 'streamComponent'
            surface.className = 'size_' + settings.video_size
            holder.replaceChildren(surface)
            xPlayer.bind()
            if(consoleController && streamType==='home') configureClassicConsoleController(xPlayer)
            else configureClassicControllerProfile(xPlayer._inputDriver,resolveClassicControllerProfile(globalSettings,profile?.controllerProfile??consoleProfile?.controllerProfile))

            // Set bitrates & video codec profiles
            if(activeCap>0)xPlayer.setVideoBitrate(activeCap)

            if(settings.video_profiles?.length > 0){
                xPlayer.setCodecPreferences('video/H264', { profiles: settings.video_profiles || [] }) // 4d = high, 42e = mid, 420 = low
            }

            // Stream is ready so we start the player
            xPlayer.setControllerRumble(settings.controller_vibration)
            let failureReason='closed'
            const failConnection=()=>{
                if(cancelled||intentionalExit.current||reconnect.current.busy)return
                setConnected(false)
                recordHistory('failed')
                stopHeartbeat.current?.();stopHeartbeat.current=undefined
                setConnectionError(failureReason)
            }
            const watcher=watchClassicConnection(failConnection)
            statsWatchdog.current.reset()
            disposeConnection=()=>{failStats.current=undefined;statsWatchdog.current.reset();watcher.dispose()}
            watcher.begin()
            const canSignal=()=>!cancelled&&!intentionalExit.current&&!reconnect.current.busy&&!watcher.failed
            failStats.current=()=>{if(canSignal()){failureReason='stats';watcher.update('failed')}}
            xPlayer.setSdpHandler((client, offer) => {
                if(!canSignal())return
                Ipc.send('streaming', 'sendChatSdp', {
                    sessionId: sessionId,
                    sdp: offer.sdp,
                }).then((sdpResponse) => {
                    if(!canSignal())return
                    xPlayer.setRemoteOffer(sdpResponse.sdp)

                }).catch((error) => {
                    if(!canSignal())return
                    console.log('ChatSDP Exchange error:', error)
                    alert(t('errors.chatSDPExchangeError') + ' ' + JSON.stringify(error))
                })
            })

            Promise.resolve().then(()=>canSignal()?xPlayer.createOffer():undefined).then((offer:any) => {
                if(!canSignal())return
                if(typeof offer?.sdp!=='string')throw Error('Missing SDP offer')
                return Ipc.send('streaming', 'sendSdp', {
                    sessionId: sessionId,
                    sdp: offer.sdp,
                }).then((sdpResult:any) => {
                    if(!canSignal())return
                    xPlayer.setRemoteOffer(sdpResult.sdp)

                    // Gather candidates
                    const iceCandidates = xPlayer.getIceCandidates()
                    const candidates = []
                    for(const candidate in iceCandidates){
                        candidates.push({
                            candidate: iceCandidates[candidate].candidate,
                            sdpMLineIndex: iceCandidates[candidate].sdpMLineIndex,
                            sdpMid: iceCandidates[candidate].sdpMid,
                        })
                    }

                    Ipc.send('streaming', 'sendIce', {
                        sessionId: sessionId,
                        ice: candidates,
                    }).then((iceResult:any) => {
                        if(!canSignal())return
                        xPlayer.setIceCandidates(iceResult)

                        // All done. Waiting for the event 'connectionstate' to be triggered

                    }).catch((error) => {
                        if(!canSignal())return
                        console.warn('ICE Exchange error:', error)
                        watcher.update('failed')
                    })

                })
            }).catch((error)=>{
                if(!canSignal())return
                console.warn('SDP Exchange error:', error)
                watcher.update('failed')
            })

            xPlayer.getEventBus().on('connectionstate', (event) => {
                if(cancelled||reconnect.current.busy)return
                if(intentionalExit.current)return
                watcher.update(event.state)
                if(watcher.failed)return
                console.log('connectionstate changed:', event)

                const connStatus = document.getElementById('component_streamcomponent_connectionstatus')
                if(event.state === 'connected'){
                        setConnected(true)
                        recovery.markConnected()
                        if(!history.current.connectedAt)history.current.connectedAt=Date.now()
                        if(connStatus)connStatus.innerText = t('streamWindow.clientHasBeenDisconnected')
                        const loader=document.getElementById('component_streamcomponent_loader')
                        if(loader)loader.className = 'hidden'

                        // Set audio / Video settings
                        // @TODO: Implement api's in xbox-xcloud-player
                        if(settings.audio_enabled === false){
                            xPlayer._audioComponent._audioRender.muted = true
                        }

                        if(settings.video_enabled === false){
                            xPlayer._videoComponent._videoRender.style.opacity = 0
                        }

                        if(!stopHeartbeat.current)stopHeartbeat.current=startHeartbeat({send:()=>Ipc.send('streaming','sendKeepalive',{sessionId}),onSuccess:()=>{if(!cancelled)setConnectionError(value=>value==='keepalive'?'':value)},onFailure:(count,error)=>{if(!cancelled){console.warn('Classic keepalive failed',count,error);if(count>=3)setConnectionError('keepalive')}}})

                } else if(connStatus&&event.state === 'new'){
                    connStatus.innerText = t('streamWindow.startingConnection')
                } else if(connStatus&&event.state === 'connecting'){
                    connStatus.innerText = t('streamWindow.connectingToConsole')
                }
            })
        } else {

            streamStateInterval.current = setInterval(() => {
                if(polling||cancelled||intentionalExit.current||reconnect.current.busy)return
                polling = true
                Ipc.send('streaming', 'getPlayerState', {
                    sessionId: sessionId,
                }).then((session:any) => {
                    if(cancelled||intentionalExit.current||reconnect.current.busy)return
                    if (!session) { clearInterval(streamStateInterval.current); recordHistory('failed'); setConnectionError('provisioning'); return }
                    console.log('Player state:', session)

                    switch(session.playerState){
                        case 'pending':
                            // Waiting for console to start
                            break

                        case 'started':
                            // Console is ready
                            clearInterval(streamStateInterval.current)

                            // Start xPlayer interface
                            setxPlayer(new xCloudPlayer('streamComponent', {
                                ui_systemui: [],
                                input_touch: !consoleController && Boolean(settings.input_touch),
                                input_mousekeyboard: !consoleController && Boolean(settings.input_mousekeyboard),
                                input_legacykeyboard: !consoleController && !settings.input_newgamepad,
                                input_mousekeyboard_config: settings.input_mousekeyboard_config !== undefined ? {
                                    _keymapping: settings.input_mousekeyboard_config,
                                } : undefined as any,
                            }))
                            break

                        case 'failed':
                            // Error
                            clearInterval(streamStateInterval.current)

                            recordHistory('failed')
                            console.log('Full stream error:', session.errorDetails)
                            setConnectionError(session.errorDetails?.code==='WNSError'&&session.errorDetails?.message?.includes('WaitingForServerToRegister')?'unavailable':'provisioning')
                            break

                        case 'queued':
                            // Waiting in queue
                            // @TODO: Show queue position
                            if(queueTime === 0){
                                setQueueTime((session.waitingTimes?.estimatedTotalWaitTimeInSeconds || 0))
                                console.log('Setting queue to:', session.waitingTimes?.estimatedTotalWaitTimeInSeconds)


                            }
                            break
                    }

                }).catch((error) => {
                    if(!cancelled&&!intentionalExit.current&&!reconnect.current.busy){clearInterval(streamStateInterval.current);recordHistory('failed');setConnectionError('provisioning')}
                }).finally(() => { polling = false })
            }, 1000)
        }

        // Modal window
        return () => {
            cancelled = true
            disposeConnection?.()
            if(xPlayer !== undefined){
                xPlayer.close()
            }

            stopHeartbeat.current?.();stopHeartbeat.current=undefined

            if(streamStateInterval.current){
                clearInterval(streamStateInterval.current)
            }
        }
    }, [router.isReady, router.query.serverid, sessionId, xPlayer])

    const retryClassic=React.useCallback((automatic=false,requestedCap:number|null=null)=>{
        if(intentionalExit.current||reconnect.current.busy||capturePending)return
        if(automatic&&cancelRecovery.current)return
        if(!activeSession.current&&(automatic||!startupFailed.current))return
        const lower=automatic&&connectionError==='closed'&&history.current.samples.at(-1)?.peerState==='failed'?recoveryBitrate(history.current.samples,activeCap,'transport',Boolean(globalSettings.v3_adaptive_recovery)):null
        const cap=requestedCap??lower
        cancelRecovery.current=true
        setRecoveryCancelled(true)
        setRetrying(true);setRetryError(false)
        recordHistory('failed')
        stopHeartbeat.current?.();stopHeartbeat.current=undefined
        // Wait for a late session ID and its acknowledged stop before remounting.
        void reconnect.current.run(async()=>{if(!await lifecycle.end())throw Error('Unable to stop previous session')},()=>{
            activeSession.current='';intentionalExit.current=true
            recovery.rememberAttempt(connectionError,history.current.samples)
            recovery.recordRetry(automatic)
            if(cap!==null)recovery.applyBitrate(cap)
            onRetry()
        },()=>{setRetrying(false);setRetryError(true)})
    },[capturePending,recordHistory,onRetry,recovery,lifecycle,connectionError,activeCap,globalSettings.v3_adaptive_recovery])
    const autoDelay=recovery.delay(Boolean(globalSettings.v3_auto_reconnect),target.startsWith('xcloud_'),{
        error:connectionError,active:Boolean(activeSession.current),blocked:capturePending||retrying||retryError||recoveryCancelled
    })
    React.useEffect(()=>{
        if(autoDelay===null)return
        const timer=setTimeout(()=>retryClassic(true),autoDelay)
        return()=>clearTimeout(timer)
    },[autoDelay,retryClassic])

    function gamepadSend(button){
        console.log('Pressed button:', button)
        xPlayer.getChannelProcessor('input').pressButton(0, 'Nexus')
    }

    function onDisconnect(){
        if(exitBusy.current||reconnect.current.busy||capturePending)return
        exitBusy.current=true
        cancelAutomaticRecovery()
        intentionalExit.current=true
        reconnect.current.dispose()
        recordHistory('ended')
        setConnected(false)
        setExiting(true)
        setConnectionError('')
        stopHeartbeat.current?.();stopHeartbeat.current=undefined
        if(streamStateInterval.current)clearInterval(streamStateInterval.current)
        // Retain remote ownership until termination is acknowledged.
        void lifecycle.end().then(stopped=>{
            exitBusy.current=false
            if(!mounted.current)return
            if(stopped){activeSession.current='';void router.replace('/home');return}
            setExiting(false)
            setConnectionError('stop')
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('streamWindow.pageTitle')} {router.query.serverid}</title>
            </Head>

            {exiting&&<div className='gl-experimental-error gl-classic-error' role='status'><p>{t('dashboard.classicStopping')}</p></div>}
            {connectionError && <div className='gl-experimental-error gl-classic-error' role='alert'><p>{t('dashboard.classicConnectionLost')}</p><p>{t('dashboard.classicFailure_'+connectionError)}</p>{retryError&&<p role='alert'>{t('dashboard.classicRetryFailed')}</p>}{retrying&&<p role='status'>{t('dashboard.classicRetrying')}</p>}{autoDelay!==null&&<p role='status'>{t('dashboard.recoveryPending')} <button type='button' className='btn' onClick={cancelAutomaticRecovery}>{t('dashboard.cancelBackup')}</button></p>}<button type='button' className='btn btn-primary' disabled={retrying||capturePending||exiting||connectionError==='stop'} onClick={()=>retryClassic()}>{t('dashboard.retryStream')}</button> <button type='button' className='btn' onClick={exportClassicDiagnostics}>{t('dashboard.exportDiagnostics')}</button> <button className='btn' disabled={(retrying&&connectionError!=='stop')||capturePending||exiting} onClick={onDisconnect}>{t(connectionError==='stop'?'dashboard.classicRetryStop':'dashboard.backHint')}</button></div>}
            { (xPlayer !== undefined) ? <StreamComponent connected={connected&&!connectionError} sessionId={sessionId} activeCap={activeCap} onRestartQuality={cap=>retryClassic(false,cap)} onCapturePending={setCapturePending} onMetrics={recordClassicSample} onExportDiagnostics={exportClassicDiagnostics} onLeave={onDisconnect} onDisconnect={ () => {
                onDisconnect()
            }} onMenu={ consoleController ? undefined : () => {
                gamepadSend('nexus')
            } } xPlayer={ xPlayer }></StreamComponent> : (queueTime > 0) ?<StreamPreload onDisconnect={ () => {
                onDisconnect()
            }} waitingTime={ queueTime }></StreamPreload> : <StreamPreload onDisconnect={ () => {
                onDisconnect()
            }}></StreamPreload> }
            {connected&&!connectionError&&!consoleController&&settings.input_touch&&xPlayer&&classicVirtualPad(xPlayer._inputDriver)&&<ClassicTouchControls pad={classicVirtualPad(xPlayer._inputDriver)!}/>}
        </React.Fragment>
    )
}

function ClassicStreamSession(){
    const recovery=React.useRef(new ClassicRecoveryBudget())
    const lifecycle=React.useRef(new SessionLifecycle())
    const [attempt,setAttempt]=React.useState(0)
    const retry=React.useCallback(()=>setAttempt(value=>value+1),[])
    return <LegacyStream key={attempt} onRetry={retry} recovery={recovery.current} lifecycle={lifecycle.current}/>
}

export default function Stream() {
    const router = useRouter()
    const { settings } = useSettings()
    const target = typeof router.query.serverid === 'string' ? router.query.serverid : ''
    const [engine, setEngine] = React.useState<string | null>(null)
    React.useEffect(() => { if (router.isReady && target && engine === null) setEngine(settings.streaming_engine || 'legacy') }, [router.isReady, target, engine, settings.streaming_engine])
    if (!engine) return null
    if (engine === 'experimental') return <ExperimentalStream key={target} target={target} onExit={() => { void router.replace('/home') }} />
    return <ClassicStreamSession key={target}/>
}
