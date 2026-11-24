import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import './Player.css';

import type { xStreamToken, xCloudStreamConfig, startStreamResponse } from '../types/index';
export type { xStreamToken, startStreamResponse, xCloudStreamConfig };

import xCloudPlayer from './lib/player';

// Proxy inputs
import Gamepad from './lib/input/gamepad';
import MouseKeyboard from './lib/input/mousekeyboard';
import Touch from './lib/input/touch';

// export { Gamepad, MouseKeyboard, Touch };

export interface StreamPlayerProps {
    onStatusChanged: (newStatus: string) => void;
    communicationHandler: communicationHandler
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
    sendKeepalive: () => Promise<any>;
}

export const StreamPlayer = forwardRef<StreamPlayerHandle, StreamPlayerProps>(
    ({
        onStatusChanged,
        communicationHandler
    }, ref): ReactElement => {
        const handler = useRef(communicationHandler);
        handler.current = communicationHandler;
        const statusCallback = useRef(onStatusChanged);
        statusCallback.current = onStatusChanged;
        const inputs = useRef<Array<{ detach: () => void }>>([]);
        const [playerState, setPlayerState] = useState<string>('Initializing');

        const playerInstance = useRef<HTMLDivElement | null>(null);
        // let player = new xCloudPlayer('playerContainer');
        const [player, setPlayer] = useState<xCloudPlayer | undefined>(undefined);

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
            let failures = 0;
            const current = handler.current;
            const status = (value: string) => { if (!disposed) setPlayerState(value) };
            const heartbeat = async () => {
                if (disposed) return;
                try { await current.sendKeepalive(); failures = 0 }
                catch { if (++failures >= 3) { status('Error'); return } }
                if (!disposed) keepalive = setTimeout(heartbeat, 30000);
            };
            const connect = async () => {
                instance = new xCloudPlayer('playerContainer');
                instance.init();
                setPlayer(instance);
                status('Connecting');
                const offer = await instance.createOffer();
                if (disposed) return;
                const answer = await current.sendSDPOffer(offer);
                if (disposed) return;
                const remote = JSON.parse(answer.exchangeResponse);
                if (typeof remote?.sdp !== 'string') throw new Error('Invalid SDP answer');
                instance.setRemoteSDP(remote.sdp);
                const localIce = await instance.getICECandidates();
                if (disposed) return;
                const candidates = localIce.map(candidate => JSON.stringify({ candidate: candidate.candidate, sdpMid: candidate.sdpMid, sdpMLineIndex: candidate.sdpMLineIndex, usernameFragment: candidate.usernameFragment }));
                const response = await current.sendICECandidates(candidates);
                if (disposed) return;
                const ice = JSON.parse(response.exchangeResponse);
                if (!Array.isArray(ice)) throw new Error('Invalid ICE response');
                instance.setRemoteIceCandidates(ice);
                status('Negotiated');
                keepalive = setTimeout(heartbeat, 30000);
            };
            const poll = async () => {
                if (disposed) return;
                try {
                    const state = await current.getStreamStatus();
                    if (disposed) return;
                    if (!state || state.error || state.state === 'Failed') { status('Error'); return }
                    if (state.state === 'Provisioned') { await connect(); return }
                    if (state.state === 'ReadyToConnect' && !authSent) { await current.sendMSALToken(); authSent = true }
                    failures = 0;
                    if (!disposed) timer = setTimeout(poll, 1000);
                } catch {
                    if (disposed) return;
                    if (instance || ++failures >= 5) { status('Error'); return }
                    timer = setTimeout(poll, 1500);
                }
            };
            void poll();
            return () => {
                disposed = true;
                clearTimeout(timer);
                clearTimeout(keepalive);
                inputs.current.forEach(input => input.detach());
                inputs.current = [];
                instance?.destroy();
            };
        }, [communicationHandler.getSessionPath()]);

        return (
            <div ref={playerInstance}>
                <div id="playerContainer"></div>
                <p role="status">{playerState}</p>
            </div>
        );
    }
);

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