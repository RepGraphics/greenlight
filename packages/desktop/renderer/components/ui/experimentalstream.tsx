import React from 'react'
import dynamic from 'next/dynamic'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { useTranslation } from 'react-i18next'

const SharedPlayer = dynamic(() => import('../../../../player/src/client/index').then(module => module.StreamPlayer), { ssr: false })

export default function ExperimentalStream({ target, onExit }: { target: string; onExit: () => void }) {
    const { settings } = useSettings()
    const { t } = useTranslation()
    const [session, setSession] = React.useState('')
    const [state, setState] = React.useState('Initializing')
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
    React.useEffect(() => {
        let disposed = false
        let active = ''
        Ipc.send('streaming', 'startStream', { type: cloud ? 'cloud' : 'home', target: id }).then((result: string) => {
            if (disposed) { void Ipc.send('streaming', 'stopStream', { sessionId: result }).catch(() => {}); return }
            active = result; setSession(result)
        }).catch(() => { if (!disposed) setState('Error') })
        return () => { disposed = true; if (active) void Ipc.send('streaming', 'stopStream', { sessionId: active }).catch(() => {}) }
    }, [target])
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
    return <section className="gl-experimental-stream">
        {session && state !== 'Error' && <SharedPlayer communicationHandler={adapter} onStatusChanged={setState} useWebGpu={false} autoGamepad vibration={settings.controller_vibration} videoBitrate={cloud ? settings.xcloud_bitrate : settings.xhome_bitrate} showStats={hud} volume={volume} muted={muted} codecProfiles={settings.video_profiles || []} touchControls={touch} microphone={mic} onMicrophoneStatus={(active, error) => { setMicBusy(false); setMicActive(active); if (error) { setMicError(true); setMic(false) } }} keyboardMapping={settings.input_mousekeyboard ? settings.input_mousekeyboard_config : undefined} />}
        <div className="gl-experimental-controls"><span>{t('dashboard.experimentalPlayer')} · {state}</span><button type="button" className="btn" aria-pressed={hud} onClick={() => setHud(value => !value)}>{t('dashboard.performanceHud')}</button><button type="button" className="btn" disabled={state !== 'Connected' || micBusy} aria-pressed={micActive} onClick={() => { setMicError(false); setMicBusy(true); setMic(!mic) }}>{t(micActive ? 'streamWindow.disableMic' : 'streamWindow.enableMic')}</button><button type="button" className="btn" aria-pressed={touch} onClick={() => setTouch(value => !value)}>{t('dashboard.touchControls')}</button><button type="button" className="btn" aria-pressed={muted} onClick={() => setMuted(value => !value)}>{t('dashboard.muteAudio')}</button><input type="range" min="0" max="1" step="0.01" aria-label={t('dashboard.volume')} value={volume} onChange={e => setVolume(Number(e.target.value))} /><button type="button" className="btn" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen() }}>{t('dashboard.fullscreen')}</button><button type="button" className="btn btn-cancel" onClick={onExit}>{t('streamWindow.endStreamBtn')}</button></div>
        {micError && <div className="gl-mic-error" role="alert">{t('dashboard.microphoneFailed')} <button className="btn" onClick={() => setMicError(false)}>{t('dashboard.dismiss')}</button></div>}
        {state === 'Error' && <div className="gl-experimental-error" role="alert">{t('dashboard.experimentalFailed')} <button className="btn" onClick={onExit}>{t('dashboard.backHint')}</button></div>}
    </section>
}
