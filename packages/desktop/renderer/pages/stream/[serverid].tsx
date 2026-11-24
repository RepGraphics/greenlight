import React from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import xCloudPlayer from 'xbox-xcloud-player'

import { useSettings } from '../../context/userContext'
import StreamComponent from '../../components/ui/streamcomponent'
import StreamPreload from '../../components/ui/streampreload'
import Ipc from '../../lib/ipc'
import { useTranslation } from 'react-i18next'

function Stream() {
    const router = useRouter()
    const { settings } = useSettings()
    const { t } = useTranslation()

    const streamStateInterval = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined)
    const keepaliveInterval = React.useRef<ReturnType<typeof setInterval> | undefined>(undefined)

    const [xPlayer, setxPlayer] = React.useState(undefined)
    const [sessionId, setSessionId] = React.useState('')
    const [queueTime, setQueueTime] = React.useState(0)
    const activeSession = React.useRef('')
    React.useEffect(() => {
        return () => {
            const id = activeSession.current
            activeSession.current = ''
            if (id) void Ipc.send('streaming', 'stopStream', { sessionId: id }).catch(() => {})
        }
    }, [])

    React.useEffect(() => {
        if (!router.isReady || typeof router.query.serverid !== 'string') return
        let cancelled = false
        let polling = false
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

            // Set bitrates & video codec profiles
            if(((streamType === 'cloud') ? settings.xcloud_bitrate : settings.xhome_bitrate) > 0){
                xPlayer.setVideoBitrate((streamType === 'cloud') ? settings.xcloud_bitrate : settings.xhome_bitrate)
            }

            if(settings.video_profiles?.length > 0){
                xPlayer.setCodecPreferences('video/H264', { profiles: settings.video_profiles || [] }) // 4d = high, 42e = mid, 420 = low
            }

            // Stream is ready so we start the player
            xPlayer.setControllerRumble(settings.controller_vibration)
            xPlayer.setSdpHandler((client, offer) => {
                Ipc.send('streaming', 'sendChatSdp', {
                    sessionId: sessionId,
                    sdp: offer.sdp,
                }).then((sdpResponse) => {
                    xPlayer.setRemoteOffer(sdpResponse.sdp)

                }).catch((error) => {
                    console.log('ChatSDP Exchange error:', error)
                    alert(t('errors.chatSDPExchangeError') + ' ' + JSON.stringify(error))
                })
            })

            xPlayer.createOffer().then((offer:any) => {
                Ipc.send('streaming', 'sendSdp', {
                    sessionId: sessionId,
                    sdp: offer.sdp,
                }).then((sdpResult:any) => {
                    if (cancelled) return
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
                        if (cancelled) return
                        xPlayer.setIceCandidates(iceResult)

                        // All done. Waiting for the event 'connectionstate' to be triggered

                    }).catch((error) => {
                        console.log('ICE Exchange error:', error)
                        alert(t('errors.ICEExchangeError') + ' ' + JSON.stringify(error))
                    })

                }).catch((error) => {
                    console.log('SDP Exchange error:', error)
                    alert(t('errors.SDPExchangeError') + ' ' + JSON.stringify(error))
                })
            })

            xPlayer.getEventBus().on('connectionstate', (event) => {
                if (cancelled) return
                console.log('connectionstate changed:', event)

                const connStatus = document.getElementById('component_streamcomponent_connectionstatus')
                if(connStatus !== null){
                    if(event.state === 'connected'){
                        connStatus.innerText = t('streamWindow.clientHasBeenDisconnected')
                        document.getElementById('component_streamcomponent_loader').className = 'hidden'

                        // Set audio / Video settings
                        // @TODO: Implement api's in xbox-xcloud-player
                        if(settings.audio_enabled === false){
                            xPlayer._audioComponent._audioRender.muted = true
                        }

                        if(settings.video_enabled === false){
                            xPlayer._videoComponent._videoRender.style.opacity = 0
                        }

                        // Start keepalive loop
                        if (keepaliveInterval.current) clearInterval(keepaliveInterval.current)
                        keepaliveInterval.current = setInterval(() => {
                            Ipc.send('streaming', 'sendKeepalive', {
                                sessionId: sessionId,
                            }).then((result) => {
                                console.log('StartStream keepalive:', result)
                            }).catch((error) => {
                                console.error('Failed to send keepalive. Error details:\n'+JSON.stringify(error))
                            })
                        }, 30000) // Send every 30 seconds

                    } else if(event.state === 'new'){
                        connStatus.innerText = t('streamWindow.startingConnection')

                    } else if(event.state === 'connecting'){
                        connStatus.innerText = t('streamWindow.connectingToConsole')

                    } else if(event.state === 'closed') {
                        // Client has been disconnected. Lets return to home.
                        // xPlayer.close()
                        console.log('Client has been disconnected. Returning to prev page.')
                        window.history.back()
                    }
                }
            })
        } else if(sessionId === '') {
            // Stream is not ready yet, lets start it...

            Ipc.send('streaming', 'startStream', {
                type: streamType,
                target: serverId,
            }).then((result:string) => {
                console.log('StartStream session:', result)
                if (cancelled) { void Ipc.send('streaming', 'stopStream', { sessionId: result }).catch(() => {}); return }
                activeSession.current = result
                setSessionId(result)

            }).catch((error) => {
                alert(t('errors.failedToStartStream') + '\n' + JSON.stringify(error))
            })
        } else {

            streamStateInterval.current = setInterval(() => {
                if (polling || cancelled) return
                polling = true
                Ipc.send('streaming', 'getPlayerState', {
                    sessionId: sessionId,
                }).then((session:any) => {
                    if (cancelled) return
                    if (!session) { clearInterval(streamStateInterval.current); alert(t('errors.failedToGetPlayerState')); void router.replace('/home'); return }
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
                                input_touch: settings.input_touch || false,
                                input_mousekeyboard: settings.input_mousekeyboard || false,
                                input_legacykeyboard: (settings.input_newgamepad) ? false : true,
                                input_mousekeyboard_config: settings.input_mousekeyboard_config !== undefined ? {
                                    _keymapping: settings.input_mousekeyboard_config,
                                } : undefined as any,
                            }))
                            break

                        case 'failed':
                            // Error
                            clearInterval(streamStateInterval.current)

                            if(session.errorDetails?.code === 'WNSError' && session.errorDetails?.message?.includes('WaitingForServerToRegister')){
                                // Detected the "WaitingForServerToRegister" error. This means the console is not connected to the xbox servers
                                alert(t('errors.unableToStartStreamSession') + '\n\n' + t('errors.streamErrorResult') + ' ' + session.state + '\n' + t('errors.details') + ' [' + session.errorDetails?.code + '] ' + session.errorDetails?.message)
                            } else {
                                alert(t('errors.streamErrorResult') + ' ' + session.state + '\n' + t('errors.details') + ' [' + session.errorDetails?.code + '] ' + session.errorDetails?.message)
                            }
                            console.log('Full stream error:', session.errorDetails)
                            onDisconnect()
                            void router.replace('/home')
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
                    if (!cancelled) { clearInterval(streamStateInterval.current); alert(t('errors.failedToGetPlayerState')); onDisconnect(); void router.replace('/home') }
                }).finally(() => { polling = false })
            }, 1000)
        }

        // Modal window
        return () => {
            cancelled = true
            if(xPlayer !== undefined){
                xPlayer.close()
            }

            if(keepaliveInterval.current){
                clearInterval(keepaliveInterval.current)
            }

            if(streamStateInterval.current){
                clearInterval(streamStateInterval.current)
            }
        }
    }, [router.isReady, router.query.serverid, sessionId, xPlayer])

    function gamepadSend(button){
        console.log('Pressed button:', button)
        xPlayer.getChannelProcessor('input').pressButton(0, 'Nexus')
    }

    function onDisconnect(){
        if (!sessionId) { void router.replace('/home'); return }
        activeSession.current = ''
        Ipc.send('streaming', 'stopStream', {
            sessionId: sessionId,
        }).then((result) => {
            console.log('Stream stopped:', result)
        }).catch(() => console.warn('Unable to stop remote session'))

        if(streamStateInterval.current){
            clearInterval(streamStateInterval.current)
        }
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('streamWindow.pageTitle')} {router.query.serverid}</title>
            </Head>

            { (xPlayer !== undefined) ? <StreamComponent onDisconnect={ () => {
                onDisconnect()
            }} onMenu={ () => {
                gamepadSend('nexus')
            } } xPlayer={ xPlayer }></StreamComponent> : (queueTime > 0) ?<StreamPreload onDisconnect={ () => {
                onDisconnect()
            }} waitingTime={ queueTime }></StreamPreload> : <StreamPreload onDisconnect={ () => {
                onDisconnect()
            }}></StreamPreload> }
        </React.Fragment>
    )
}

export default Stream
