import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import type { xStreamToken, xCloudStreamConfig, startStreamResponse } from '../types/index';
export type { xStreamToken, startStreamResponse, xCloudStreamConfig };

import xCloudPlayer from './lib/player';
import { statsExpired } from './lib/statsfreshness';
import { StreamConnectionWatchdog } from './lib/connectionwatchdog';

// Proxy inputs
import Gamepad from './lib/input/gamepad';
import { reconcileSlots } from './lib/input/slots';
import type { ControllerSlot } from './lib/input/slots';
import MouseKeyboard from './lib/input/mousekeyboard';
import Touch from './lib/input/touch';

// export { Gamepad, MouseKeyboard, Touch };

export interface StreamMetrics { width: number; height: number; fps: number; bitrate: number; jitter: number; loss: number; rtt: number; statsAgeMs?:number; statsFresh?:boolean; peerState?:string; iceState?:string; signalingState?:string }

export interface StreamPlayerProps {
    onStatusChanged: (newStatus: string) => void;
    communicationHandler: communicationHandler;
    useWebGpu?: boolean;
    autoGamepad?: boolean;
    multiController?: boolean;
    consoleController?: boolean;
    vibration?: boolean;
    videoBitrate?: number;
    showStats?: boolean;
    volume?: number;
    muted?: boolean;
    codecProfiles?: string[];
    touchControls?: boolean;
    keyboardMapping?: Record<string, string>;
    microphone?: boolean;
    nativeMouseKeyboard?: boolean;
    deadzone?: number;
    invertY?: boolean;
    swapSticks?: boolean;
    mouseSensitivity?: number;
    buttonMapping?: Record<string, string>;
    onMetrics?: (metrics: StreamMetrics) => void;
    keyframeRequest?: number;
    onFailureReason?: (reason: string) => void;
    onMicrophoneStatus?: (active: boolean, error?: boolean) => void;
}
export interface StreamPlayerHandle {
    ping: (echo: string) => void;
    attachGamepad: (index?: number) => VirtualGamepad;
    attachMouseKeyboard: (index?: number) => VirtualMKB;
    toggleDebugOverlay: () => void;
}

export interface communicationHandler {
    getSessionId: () => string;
    getStreamStatus: () => Promise<any>;
    getSessionPath: () => string;
    getStreamConfig: () => xCloudStreamConfig;
    sendSDPOffer: (sdpOffer:RTCSessionDescriptionInit) => Promise<any>;
    sendICECandidates: (candidates:Array<any>) => Promise<any>;
    sendMSALToken: () => Promise<any>;
    sendChatSDP?: (offer: RTCSessionDescriptionInit) => Promise<string>;
    sendKeepalive: () => Promise<any>;
}

export const StreamPlayer = forwardRef<StreamPlayerHandle, StreamPlayerProps>(
    ({
        onStatusChanged,
        communicationHandler, useWebGpu = true, autoGamepad = false, multiController = false, consoleController = false, vibration = true, videoBitrate = 0, showStats = false, volume = 1, muted = false, codecProfiles = [], touchControls = false, keyboardMapping, microphone = false, onMicrophoneStatus, nativeMouseKeyboard = false, deadzone = 0.08, invertY = false, swapSticks = false, mouseSensitivity = 1, buttonMapping, onMetrics, keyframeRequest = 0, onFailureReason
    }, ref): ReactElement => {
        const playback=useRef({volume,muted});
        playback.current={volume,muted};
        const handler = useRef(communicationHandler);
        handler.current = communicationHandler;
        const failureCallback=useRef(onFailureReason);
        failureCallback.current=onFailureReason;
        const statusCallback = useRef(onStatusChanged);
        statusCallback.current = onStatusChanged;
        const controller = useRef<Gamepad | undefined>(undefined);
        const pressed = useRef(new Map<number, string>());
        const stickOwners=useRef(new Map<'Left'|'Right',number>());
        const [touchEpoch,setTouchEpoch]=useState(0);
        const releaseTouch = () => {
            for(const button of new Set(pressed.current.values()))controller.current?.sendButtonState(button,0);
            const hadInput=pressed.current.size>0||stickOwners.current.size>0;
            pressed.current.clear();stickOwners.current.clear();
            controller.current?.releaseVirtualStick('Left');controller.current?.releaseVirtualStick('Right');
            if(hadInput)setTouchEpoch(epoch=>epoch+1);
        };
        useEffect(() => {
            if (!touchControls) releaseTouch();
            const hidden=()=>{if(document.hidden)releaseTouch()};
            window.addEventListener('blur',releaseTouch);document.addEventListener('visibilitychange',hidden);
            return()=>{window.removeEventListener('blur',releaseTouch);document.removeEventListener('visibilitychange',hidden);releaseTouch()};
        },[touchControls]);
        const releaseButton=(pointer:number)=>{
            const button=pressed.current.get(pointer);
            if(!button)return;
            pressed.current.delete(pointer);
            if(!Array.from(pressed.current.values()).includes(button))controller.current?.sendButtonState(button,0);
        };
        const startStick=(side:'Left'|'Right',pointer:number)=>{
            if(!controller.current||document.hidden||!document.hasFocus()||stickOwners.current.has(side))return false;
            stickOwners.current.set(side,pointer);return true;
        };
        const moveStick=(side:'Left'|'Right',pointer:number,x:number,y:number)=>{
            if(stickOwners.current.get(side)!==pointer)return;
            controller.current?.setVirtualStick(side,x,y);
        };
        const releaseStick=(side:'Left'|'Right',pointer:number)=>{
            if(stickOwners.current.get(side)!==pointer)return;
            stickOwners.current.delete(side);controller.current?.releaseVirtualStick(side);
        };
        const inputs = useRef<Array<{ detach: () => void }>>([]);
        const [playerState, setPlayerState] = useState<string>('Initializing');

        const playerInstance = useRef<HTMLDivElement | null>(null);
        // let player = new xCloudPlayer('playerContainer');
        const [player, setPlayer] = useState<xCloudPlayer | undefined>(undefined);

        const lastKeyframeRequest = useRef(0);
        useEffect(() => {
            if (player && playerState === 'Connected' && keyframeRequest > lastKeyframeRequest.current) {
                lastKeyframeRequest.current = keyframeRequest;
                player._channels.control.requestKeyframeRequest(true);
            }
        }, [player, playerState, keyframeRequest]);
        useEffect(()=>{if(player)player.consoleController=consoleController},[player,consoleController]);
        // Register a remote controller only when the client actually needs one.
        useEffect(() => {
            if (!player || playerState !== 'Connected' || !autoGamepad || consoleController || multiController) return;
            let attached: Gamepad | undefined;
            const sync = () => {
                const hasPhysical = Array.from(navigator.getGamepads?.() || []).some(pad => pad?.connected);
                const needed = hasPhysical || touchControls || Boolean(keyboardMapping);
                if (needed && !attached) {
                    const mapping = keyboardMapping ? Object.fromEntries(Object.entries(keyboardMapping).map(([key,button])=>[button,key])) : undefined;
                    attached = new Gamepad(0,{enable_keyboard:Boolean(mapping),...(mapping?{keyboard_mapping:mapping}:{}),enable_vibration:vibration,gamepad_deadzone:deadzone,gamepad_invert_y:invertY,gamepad_swap_sticks:swapSticks,gamepad_mapping:buttonMapping});
                    attached.attach(player); controller.current = attached;
                } else if (!needed && attached) {
                    attached.detach(); attached=undefined; controller.current=undefined;
                }
            };
            sync(); const timer=setInterval(sync,500);
            return () => { clearInterval(timer); if(attached){releaseTouch();attached.detach()} controller.current=undefined };
        }, [player,playerState,autoGamepad,consoleController,multiController,touchControls,keyboardMapping,vibration,deadzone,invertY,swapSticks,buttonMapping]);
        useEffect(()=>{
            if(!player||playerState!=='Connected'||!autoGamepad||consoleController||!multiController)return;
            let slots:ControllerSlot[]=[];
            const attached=new Map<number,Gamepad>();
            const mapping=keyboardMapping?Object.fromEntries(Object.entries(keyboardMapping).map(([key,button])=>[button,key])):undefined;
            const sync=()=>{
                const ids=Array.from(navigator.getGamepads?.()||[]).filter(pad=>pad?.connected).map(pad=>pad!.index);
                const next=reconcileSlots(slots,ids,touchControls||Boolean(mapping));
                for(const old of slots){if(!next.some(item=>item.slot===old.slot&&item.physicalId===old.physicalId)){if(old.slot===0){releaseTouch();controller.current=undefined}attached.get(old.slot)?.detach();attached.delete(old.slot)}}
                for(const entry of next){if(attached.has(entry.slot))continue;const primary=entry.slot===0;const input=new Gamepad(entry.slot,{enable_gamepad:entry.physicalId!==null,physical_gamepad_id:entry.physicalId??-1,enable_keyboard:primary&&Boolean(mapping),...(primary&&mapping?{keyboard_mapping:mapping}:{}),enable_vibration:vibration,gamepad_deadzone:deadzone,gamepad_invert_y:invertY,gamepad_swap_sticks:swapSticks,gamepad_mapping:buttonMapping});input.attach(player);attached.set(entry.slot,input);if(primary)controller.current=input}
                slots=next;
            };
            sync();const timer=setInterval(sync,500);
            return()=>{clearInterval(timer);releaseTouch();attached.forEach(input=>input.detach());controller.current=undefined};
        },[player,playerState,autoGamepad,multiController,consoleController,touchControls,keyboardMapping,vibration,deadzone,invertY,swapSticks,buttonMapping]);
        const micCallback = useRef(onMicrophoneStatus);
        micCallback.current = onMicrophoneStatus;
        useEffect(() => {
            if (!player || playerState !== 'Connected') return;
            let disposed = false;
            player._channels.chat.setMicrophone(microphone, handler.current.sendChatSDP).then(active => { if (!disposed) micCallback.current?.(active) }).catch(() => { if (!disposed) micCallback.current?.(false, true) });
            return () => { disposed = true };
        }, [player, playerState, microphone]);
        useEffect(() => {
            if (!player || consoleController || !nativeMouseKeyboard || playerState !== 'Connected') return;
            const input = new MouseKeyboard(0, mouseSensitivity);
            let surface: HTMLElement | undefined;
            const sync = () => {
                const candidate = player.getVideoElement();
                const element = candidate?.isConnected ? candidate : undefined;
                if (element === surface) return;
                input.detach(); surface = element;
                if(element)input.attach(player);
            };
            sync(); const timer = setInterval(sync, 500);
            return () => { clearInterval(timer); input.detach() };
        }, [player, consoleController, nativeMouseKeyboard, playerState, mouseSensitivity]);
        const metricsCallback = useRef(onMetrics);
        metricsCallback.current = onMetrics;
        const [metrics, setMetrics] = useState<StreamMetrics>({ width: 0, height: 0, fps: 0, bitrate: 0, jitter: 0, loss: 0, rtt: 0 });
        useEffect(() => {
            if (!player) return;
            const update = () => {
                if (showStats || metricsCallback.current) {
                    const stats = player.getStats();
                    const age=stats.lastStatsAt?performance.now()-stats.lastStatsAt:0;
                    const fresh=stats.lastStatsAt>0&&age<5000;
                    const next = { width: stats._videoWidth, height: stats._videoHeight, fps: fresh?stats._videoFps:0, bitrate: fresh?stats._bitrate:0, jitter: fresh?stats._jitter:0, loss: stats._packetsLost, rtt: fresh?stats._rtt * 1000:0, statsAgeMs:age, statsFresh:fresh, peerState:player._peerConnection.connectionState, iceState:player._peerConnection.iceConnectionState, signalingState:player._peerConnection.signalingState };
                    if (showStats) setMetrics(next);
                    metricsCallback.current?.(next);
                }
            };
            update();
            const timer = setInterval(update, 1000);
            return () => clearInterval(timer);
        }, [player, showStats]);
        useEffect(()=>{player?.setPlayback(volume,muted)},[player,volume,muted]);

        useImperativeHandle(ref, () => ({
            ping(echo: string) {
                // Call into the actual player SDK here
                console.log('Pinging player', echo, playerInstance.current);
            },
            attachGamepad(index = 0) {
                if(!player){
                    throw new Error('Player is not initialized yet');
                }
                const gamepad = new VirtualGamepad(player)
                gamepad.attach(index)
                inputs.current.push(gamepad)
                return gamepad
            },
            attachMouseKeyboard(index = 0) {
                if(!player){
                    throw new Error('Player is not initialized yet');
                }
                const mkb = new VirtualMKB(player)
                mkb.attach(index)
                inputs.current.push(mkb)
                return mkb
            },
            toggleDebugOverlay() {
                if(!player){
                    throw new Error('Player is not initialized yet');
                }
                player.toggleDebugOverlay()
            }
        }));

        useEffect(() => { statusCallback.current?.(playerState) }, [playerState]);

        useEffect(() => {
            let disposed = false;
            let timer: ReturnType<typeof setTimeout>;
            let keepalive: ReturnType<typeof setTimeout>;
            let instance: xCloudPlayer | undefined;
            let authSent = false;
            let mediaWatchdog:ReturnType<typeof setInterval>;
            let terminal=false;
            let failures = 0;
            const current = handler.current;
            const active=()=>!disposed&&!terminal;
            const status=(value:string)=>{if(active())setPlayerState(value)};
            let removeConnectionListener:(()=>void)|undefined;
            const clearTimers=()=>{clearTimeout(timer);clearTimeout(keepalive);clearInterval(mediaWatchdog);watchdog.dispose();removeConnectionListener?.();removeConnectionListener=undefined};
            const fail=(reason:string)=>{
                if(!active())return;
                terminal=true;clearTimers();
                failureCallback.current?.(reason);setPlayerState('Error');
            };
            const watchdog=new StreamConnectionWatchdog(fail);
            watchdog.beginProvisioning();
            const heartbeat = async () => {
                if (disposed || terminal) return;
                try { await current.sendKeepalive(); failures = 0 }
                catch { if (++failures >= 3) { fail('heartbeat'); return } }
                if (!disposed && !terminal) keepalive = setTimeout(heartbeat, failures ? 5000 : 20000);
            };
            const connect = async () => {
                if(!active())return;
                watchdog.beginHandshake();
                instance = new xCloudPlayer('playerContainer', useWebGpu, videoBitrate, codecProfiles, consoleController,playback.current.volume,playback.current.muted);
                instance.init();
                setPlayer(instance);
                status('Connecting');
                const offer = await instance.createOffer();
                if (!active()) return;
                const answer = await current.sendSDPOffer(offer);
                if (!active()) return;
                const remote = JSON.parse(answer.exchangeResponse);
                if (typeof remote?.sdp !== 'string') throw new Error('Invalid SDP answer');
                await instance.setRemoteSDP(remote.sdp);
                if(!active())return;
                const localIce = await instance.getICECandidates();
                if (!active()) return;
                const candidates = localIce.map(candidate => JSON.stringify({ candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment }));
                const response = await current.sendICECandidates(candidates);
                if (!active()) return;
                const ice = JSON.parse(response.exchangeResponse);
                if (!Array.isArray(ice)) throw new Error('Invalid ICE response');
                await instance.setRemoteIceCandidates(ice);
                if (!active()) return;
                const peer = instance._peerConnection;
                const onConnection = () => {
                    if (!active()) return;
                    watchdog.update(peer.connectionState);
                    if(!active())return;
                    if (peer.connectionState === 'connected') { status('Connected'); instance?._channels.control.requestKeyframeRequest(true) }
                    else if (peer.connectionState === 'disconnected') status('Reconnecting');
                };
                peer.addEventListener('connectionstatechange', onConnection);
                removeConnectionListener=()=>peer.removeEventListener('connectionstatechange',onConnection);
                status('Negotiated'); onConnection();
                if(!active())return;
                void heartbeat();
                let visibleConnectedAt=performance.now();
                mediaWatchdog=setInterval(()=>{const now=performance.now();if(disposed||terminal)return;if(peer.connectionState==='new'||peer.connectionState==='connecting' && !instance?.getStats().lastStatsAt){visibleConnectedAt=now;return}if(instance?.serverDisconnected){fail('server');return}const stats=instance?.getStats();if(!stats)return;if(statsExpired(now,stats.lastStatsAt,visibleConnectedAt))fail('stats');else if(stats.mediaStalled)fail('media')},1000);
            };
            const poll = async () => {
                if (!active()) return;
                try {
                    const state = await current.getStreamStatus();
                    if (!active()) return;
                    if (!state || state.error || state.state === 'Failed') { fail('server'); return }
                    if (state.state === 'Provisioned') { await connect(); return }
                    if (state.state === 'ReadyToConnect' && !authSent) { await current.sendMSALToken(); if(!active())return; authSent = true }
                    failures = 0;
                    if (active()) timer = setTimeout(poll, 1000);
                } catch {
                    if (!active()) return;
                    if (instance || ++failures >= 5) { fail(instance?'transport':'server'); return }
                    timer = setTimeout(poll, 1500);
                }
            };
            void poll();
            return () => {
                disposed = true;
                clearTimers();
                releaseTouch(); controller.current = undefined;
                inputs.current.forEach(input => { try { input.detach() } catch { /* continue cleanup */ } });
                inputs.current = [];
                instance?.destroy();
            };
        }, [communicationHandler.getSessionPath()]);

        const touchButton=(button:string,label:string)=><button key={button} type="button" aria-label={button} onPointerDown={event=>{
            if(event.button!==0||!controller.current||document.hidden||!document.hasFocus()||pressed.current.has(event.pointerId))return;
            event.preventDefault();
            try{event.currentTarget.setPointerCapture(event.pointerId)}catch{return}
            pressed.current.set(event.pointerId,button);controller.current.sendButtonState(button,1);
        }} onPointerUp={event=>releaseButton(event.pointerId)} onPointerCancel={event=>releaseButton(event.pointerId)} onLostPointerCapture={event=>releaseButton(event.pointerId)}>{label}</button>;
        return (
            <div ref={playerInstance}>
                <div id="playerContainer"></div>
                {!consoleController && touchControls && playerState === 'Connected' && <div key={touchEpoch} className="gl-touch-overlay"><div className="gl-touch-shoulders">{touchButton('LeftTrigger','LT')}{touchButton('LeftShoulder','LB')}{touchButton('View','▣')}{touchButton('Nexus','Xbox')}{touchButton('Menu','☰')}{touchButton('RightShoulder','RB')}{touchButton('RightTrigger','RT')}</div><div className="gl-touch-dpad">{touchButton('DPadUp','↑')}{touchButton('DPadLeft','←')}{touchButton('DPadRight','→')}{touchButton('DPadDown','↓')}</div><VirtualStick side="Left" onStart={id=>startStick('Left',id)} onMove={(id,x,y)=>moveStick('Left',id,x,y)} onRelease={id=>releaseStick('Left',id)}/><VirtualStick side="Right" onStart={id=>startStick('Right',id)} onMove={(id,x,y)=>moveStick('Right',id,x,y)} onRelease={id=>releaseStick('Right',id)}/><div className="gl-touch-abxy">{touchButton('Y','Y')}{touchButton('X','X')}{touchButton('B','B')}{touchButton('A','A')}</div></div>}
                {showStats && <div className="gl-performance-hud"><span>{metrics.width ? metrics.width + '×' + metrics.height : '—'}</span><span>{Math.round(metrics.fps)} FPS</span><span>{metrics.bitrate.toFixed(1)} Mbps</span><span>{metrics.jitter.toFixed(1)} ms jitter</span><span>{metrics.loss} packets lost</span></div>}
            </div>
        );
    }
);

function VirtualStick({side,onStart,onMove,onRelease}:{side:'Left'|'Right';onStart:(id:number)=>boolean;onMove:(id:number,x:number,y:number)=>void;onRelease:(id:number)=>void}){
    const pointer=useRef<number|null>(null);
    const [position,setPosition]=useState({x:0,y:0});
    const release=(id:number)=>{if(pointer.current!==id)return;pointer.current=null;setPosition({x:0,y:0});onRelease(id)};
    const move=(event:React.PointerEvent<HTMLDivElement>)=>{
        if(pointer.current!==event.pointerId)return;
        const rect=event.currentTarget.getBoundingClientRect(),radius=Math.max(1,rect.width/2);
        let x=(event.clientX-rect.left-rect.width/2)/radius,y=(event.clientY-rect.top-rect.height/2)/radius;
        if(!Number.isFinite(x)||!Number.isFinite(y)){x=0;y=0}
        const length=Math.max(1,Math.hypot(x,y));x/=length;y/=length;
        setPosition({x,y});onMove(event.pointerId,x,y);
    };
    return <div className={'gl-virtual-stick gl-stick-'+side.toLowerCase()} aria-label={side+' analogue stick'} onPointerDown={event=>{
        if(pointer.current!==null||event.button!==0||!onStart(event.pointerId))return;
        event.preventDefault();
        try{event.currentTarget.setPointerCapture(event.pointerId)}catch{onRelease(event.pointerId);return}
        pointer.current=event.pointerId;move(event);
    }} onPointerMove={move} onPointerUp={event=>release(event.pointerId)} onPointerCancel={event=>release(event.pointerId)} onLostPointerCapture={event=>release(event.pointerId)}><span style={{transform:'translate('+position.x*55+'%, '+position.y*55+'%)'}}/></div>
}

// CONTROLS

class VirtualGamepad {

    _isAttached = false
    _gamepad:Gamepad | undefined
    _player:xCloudPlayer

    constructor(player:xCloudPlayer) {
        this._player = player
    }

    attach(index = 0) {
        console.log('[VirtualGamepad] Attaching virtual gamepad on index:', index)
        this._gamepad = new Gamepad(index, { 
            enable_keyboard: true,
        })

        if(this._player){
            this._gamepad.attach(this._player)
            this._isAttached = true
        } else {
            console.log('[VirtualGamepad] Failed to attach gamepad to Player istance:', this._player)
            return
        }
    }

    detach() {
        if(this._isAttached === false){
            console.log('[VirtualGamepad] Virtual Gamepad is not attached')
            return
        }
        this._gamepad?.detach()
        this._isAttached = false
    }

    sendGamepadButtonPress(button: string) {
        this._gamepad?.sendButtonState(button, 1)
        setTimeout(() => {
            this._gamepad?.sendButtonState(button, 0)
        }, 50)
    }

    sendGamepadButtonState(button: string, value: number) {
        this._gamepad?.sendButtonState(button, value)
    }
}

class VirtualMKB {
    _isAttached = false
    _mkb: MouseKeyboard | undefined
    _player:xCloudPlayer

    constructor(player:xCloudPlayer) {
        this._player = player
    }

    attach(index = 0) {
        console.log('[VirtualMKB] Attaching MKB on index:', index)
        this._mkb = new MouseKeyboard(index)

        if(this._player){
            this._mkb.attach(this._player)
            this._isAttached = true
        } else {
            console.log('[VirtualMKB] Failed to attach MKB to Player istance:', this._player)
            return
        }
    }

    detach() {
        if(this._isAttached === false){
            console.log('[VirtualMKB] Virtual MKB is not attached')
            return
        }
        this._mkb?.detach()
        this._isAttached = false
    }
}