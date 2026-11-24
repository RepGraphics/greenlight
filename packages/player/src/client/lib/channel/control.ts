import Gamepad from '../input/gamepad'
import MouseKeyboard from '../input/mousekeyboard'
import Touch from '../input/touch'
import Channel from './channel'

interface GamepadHandlers {
    0: undefined|Gamepad|MouseKeyboard|Touch;
    1: undefined|Gamepad|MouseKeyboard|Touch;
    2: undefined|Gamepad|MouseKeyboard|Touch;
    3: undefined|Gamepad|MouseKeyboard|Touch;
}

export default class ControlChannel extends Channel {
    private authorizationRequested = false
    private authorized = false
    private lastKeyframe = -Infinity
    _keyframeInterval
    _gamepadHandlers:GamepadHandlers = {
        0: undefined,
        1: undefined,
        2: undefined,
        3: undefined,
    }

    getChannelName() {
        return 'control'
    }

    getChannelConfig() {
        return {
            protocol: 'controlV1',
            ordered: true,
        }
    }

    destroy() {
        // console.log('DebugChannel destroy() called')
        clearInterval(this._keyframeInterval)

        this._gamepadHandlers[0]?.detach()
        this._gamepadHandlers[1]?.detach()
        this._gamepadHandlers[2]?.detach()
        this._gamepadHandlers[3]?.detach()
    }

    onOpen() { if (this.authorizationRequested) this.sendAuthorization() }

    sendAuthorization(){
        this.authorizationRequested = true
        if (!this.isOpen() || this.authorized) return
        this.authorized = true
        const authRequest = JSON.stringify({
            'message':'authorizationRequest',
            'accessKey':'4BDB3609-C1F1-4195-9B37-FEFF45DA8B8E',
        })

        this.send(authRequest)

        if (!this._gamepadHandlers[0]) { this.sendGamepadState(0, true); this.sendGamepadState(0, false) }
        for (const index of [0,1,2,3]) if (this._gamepadHandlers[index]) this.sendGamepadState(index, true)

        // if(this.getPlayer()._config.keyframe_interval > 0) {
        //     this._keyframeInterval = setInterval(() => {
        //         this.requestKeyframeRequest(true)
        //     }, this.getPlayer()._config.keyframe_interval*1000)
        // }
    }

    sendGamepadState(gamepadIndex, wasAdded = true, handler:undefined|Gamepad|MouseKeyboard|Touch = undefined) {
       
        if(wasAdded === true){
            if(handler !== undefined){
                if(this._gamepadHandlers[gamepadIndex] !== undefined && this._gamepadHandlers[gamepadIndex] !== handler){
                    this._gamepadHandlers[gamepadIndex]?.detach()
                }
                this._gamepadHandlers[gamepadIndex] = handler
            }
        } else {
            this._gamepadHandlers[gamepadIndex] = undefined
        }

        if (!this.authorized) return
        const gamepadRequest = JSON.stringify({
            'message': 'gamepadChanged',
            'gamepadIndex': gamepadIndex,
            'wasAdded': wasAdded,
        })
        this.send(gamepadRequest)
    }

    requestKeyframeRequest(ifrRequested = false) {
        if (!this.isOpen() || !this.authorized || performance.now() - this.lastKeyframe < 3000) return false
        this.lastKeyframe = performance.now()
        const keyframeRequest = JSON.stringify({
            message: 'videoKeyframeRequested',
            ifrRequested: ifrRequested,
        })

        this.send(keyframeRequest)
        return true
    }

    getGamepadHandlers(){
        return this._gamepadHandlers
    }

    getGamepadHandler(index):Gamepad|undefined{
        for(const gamepad in this.getPlayer()._channels.control.getGamepadHandlers()){
            if(
                this.getPlayer()._channels.control.getGamepadHandlers()[gamepad] instanceof Gamepad &&
                (this.getPlayer()._channels.control.getGamepadHandlers()[gamepad] as Gamepad).getPhysicalGamepadId() === index
            ) {
                return this.getPlayer()._channels.control.getGamepadHandlers()[gamepad]
            }
        }

        return undefined
    }
}