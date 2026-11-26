import xCloudPlayer from '../player'
import { validateButtonMapping } from './mapping'
import { selectPhysicalGamepad } from './slots'
import { VibrationFrame } from '../channel/input'
import { resolveRumbleEffect, type RumbleActuator } from './rumble'
import { KeyboardGamepadState, isEditableGamepadTarget } from './keyboardstate'
import { GuidePulse } from './guidepulse'

export interface GamepadOptions {
    physical_gamepad_id?: number;
    enable_keyboard?: boolean;
    enable_gamepad?: boolean;
    enable_vibration?: boolean;
    keyboard_mapping?: {
        [key:string]: string;
    };
    gamepad_mapping?: {
        [key:string]: string;
    };
    gamepad_axes_mapping?: {
        [key:string]: string;
    };
    gamepad_deadzone?: number;
    gamepad_invert_y?: boolean;
    gamepad_swap_sticks?: boolean;
    gamepad_force_capture?: boolean;
}

export interface GamepadOptionsDefaults extends Required<GamepadOptions> {}

export default class Gamepad {
    private _player: xCloudPlayer | undefined
    private _index: number
    private _physicalGamepadId = -1
    private neutralPending = false
    private virtualAxes: Record<string, number> = {}
    private virtualReleasePending=false
    private guidePulse=new GuidePulse()
    private keyboardState=new KeyboardGamepadState()
    private get observesFocus(){return !this._options.gamepad_force_capture}
    private onVisibility=()=>{if(document.hidden)this.onWindowBlur();else if(document.hasFocus())this.onWindowFocus()}
    private _rumbleInterval
    private _isFocused = true
    private _gamepadOverride = {
        buttons: {},
    }

    private _options:GamepadOptionsDefaults = {
        physical_gamepad_id: -1,
        enable_keyboard: false,
        enable_gamepad: true,
        enable_vibration: true,
        keyboard_mapping: {
            'A': 'Enter',
            'B': 'Backspace',
            'X': 'x',
            'Y': 'y',
            'DPadUp': 'ArrowUp',
            'DPadDown': 'ArrowDown',
            'DPadLeft': 'ArrowLeft',
            'DPadRight': 'ArrowRight',
            'LeftShoulder': '[',
            'RightShoulder': ']',
            'LeftThumb': 'l',
            'RightThumb': 'r',
            'LeftTrigger': '-',
            'RightTrigger': '=',
            'Menu': 'm',
            'View': 'v',
            'Nexus': 'n',
        },
        gamepad_mapping: {
            'A': '0',
            'B': '1',
            'X': '2',
            'Y': '3',
            'DPadUp': '12',
            'DPadDown': '13',
            'DPadLeft': '14',
            'DPadRight': '15',
            'LeftShoulder': '4',
            'RightShoulder': '5',
            'LeftThumb': '10',
            'RightThumb': '11',
            'LeftTrigger': '6',
            'RightTrigger': '7',
            'Menu': '9',
            'View': '8',
            'Nexus': '16',
        },
        gamepad_axes_mapping: {
            'LeftThumbXAxis': '0',
            'LeftThumbYAxis': '1',
            'RightThumbXAxis': '2',
            'RightThumbYAxis': '3',
        },
        gamepad_deadzone: 0.08,
        gamepad_invert_y: false,
        gamepad_swap_sticks: false,
        gamepad_force_capture: false,
    }

    private _listener = {
        keyDown: this.onKeyDown.bind(this),
        keyUp: this.onKeyUp.bind(this),
        gamepadConnected: this.onGamepadConnected.bind(this),
        gamepadDisconnected: this.onGamepadDisconnected.bind(this),
        windowFocus: this.onWindowFocus.bind(this),
        windowBlur: this.onWindowBlur.bind(this),
    }

    constructor(index:number, options:GamepadOptions = {}){
        this._index = index

        this._options = {
            ...this._options,
            ...options,
            gamepad_mapping: validateButtonMapping(options.gamepad_mapping),
        }
    }

    attach(xCloudPlayer:xCloudPlayer){
        this._player = xCloudPlayer
        this._isFocused=!this.observesFocus||(!document.hidden&&document.hasFocus())

        this._player._channels.control.sendGamepadState(this._index, true, this)

        if(this._options.enable_keyboard === true){
            window.addEventListener('keydown', this._listener.keyDown)
            window.addEventListener('keyup', this._listener.keyUp)
        }

        if(this._options.enable_gamepad === true){
            window.addEventListener('gamepadconnected', this._listener.gamepadConnected)
            window.addEventListener('gamepaddisconnected', this._listener.gamepadDisconnected)
        }

        if(this.observesFocus){
            window.addEventListener('blur', this._listener.windowBlur)
            window.addEventListener('focus', this._listener.windowFocus)
            document.addEventListener('visibilitychange',this.onVisibility)
        }

        if (this._options.enable_gamepad) {
            this.detectActiveGamepad()
        }
    }

    detach(){
        if(this._player === undefined){
            console.log('[Gamepad] Player is not attached. this._player is:', this._player)
            return
        }
        this._player._channels.control.sendGamepadState(this._index, false)
        this._physicalGamepadId = -1
        this._gamepadOverride.buttons = {}
        this.virtualAxes = {}
        this.virtualReleasePending=false
        this.guidePulse.clear()
        this.keyboardState.clear()
        this._player = undefined

        this.stopRumble()
        this.neutralPending = false

        if(this._options.enable_keyboard === true){
            window.removeEventListener('keydown', this._listener.keyDown)
            window.removeEventListener('keyup', this._listener.keyUp)
        }

        if(this._options.enable_gamepad === true){
            window.removeEventListener('gamepadconnected', this._listener.gamepadConnected)
            window.removeEventListener('gamepaddisconnected', this._listener.gamepadDisconnected)
        }

        if(this.observesFocus){
            window.removeEventListener('blur', this._listener.windowBlur)
            window.removeEventListener('focus', this._listener.windowFocus)
            document.removeEventListener('visibilitychange',this.onVisibility)
        }
    }

    setVirtualStick(side: 'Left' | 'Right', x: number, y: number) {
        if(!this._player||!this._isFocused)return
        const clamp=(n:number)=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0
        this.virtualAxes[side+'ThumbXAxis']=clamp(x)
        this.virtualAxes[side+'ThumbYAxis']=clamp(y)
    }

    releaseVirtualStick(side: 'Left' | 'Right') {
        const x=side+'ThumbXAxis',y=side+'ThumbYAxis'
        if(x in this.virtualAxes||y in this.virtualAxes)this.virtualReleasePending=true
        delete this.virtualAxes[x]
        delete this.virtualAxes[y]
    }

    sendButtonState(button:string,value:number){
        if(!this._player||!this._isFocused)return
        if(!Object.prototype.hasOwnProperty.call(this._options.gamepad_mapping,button))return
        if(!Number.isFinite(value))return
        const strength=Math.max(0,Math.min(1,value))
        if(strength>0)this._gamepadOverride.buttons[button]=strength
        else if(Object.prototype.hasOwnProperty.call(this._gamepadOverride.buttons,button)){
            delete this._gamepadOverride.buttons[button]
            this.virtualReleasePending=true
        }
    }

    onKeyDown(event:KeyboardEvent){
        if(!this._isFocused)return
        if(this.keyboardState.press(event,this._options.keyboard_mapping,isEditableGamepadTarget(event.target)))event.preventDefault()
    }

    onKeyUp(event:KeyboardEvent){
        if(this.keyboardState.release(event))event.preventDefault()
    }

    onWindowFocus(){
        this._isFocused = true
    }

    onWindowBlur(){
        this.stopRumble()
        this._isFocused = false
        this._gamepadOverride.buttons = {}
        this.virtualAxes = {}
        this.virtualReleasePending=false
        this.guidePulse.clear()
        this.keyboardState.clear()
        this.neutralPending = true
    }

    getDefaultFamepadFrame(){
        return {
            GamepadIndex: 0,
            Nexus: 0,
            Menu: 0,
            View: 0,
            A: 0,
            B: 0,
            X: 0,
            Y: 0,
            DPadUp: 0,
            DPadDown: 0,
            DPadLeft: 0,
            DPadRight: 0,
            LeftShoulder: 0,
            RightShoulder: 0,
            LeftThumb: 0,
            RightThumb: 0,

            LeftThumbXAxis: 0,
            LeftThumbYAxis: 0,
            RightThumbXAxis: 0,
            RightThumbYAxis: 0,
            LeftTrigger: 0,
            RightTrigger: 0,
        }
    }

    private stopRumble(){
        clearInterval(this._rumbleInterval)
        this._rumbleInterval=undefined
    }

    detectActiveGamepad(){
        if(!this._options.enable_gamepad||!this._player)return
        const available=Array.from(navigator.getGamepads?.()||[]).filter(pad=>pad?.connected).map(pad=>pad!.index)
        const occupied=Object.values(this._player._channels.control.getGamepadHandlers()).filter((handler):handler is Gamepad=>handler instanceof Gamepad&&handler!==this).map(handler=>handler.getPhysicalGamepadId())
        const previous=this._physicalGamepadId
        this._physicalGamepadId=selectPhysicalGamepad(previous,this._options.physical_gamepad_id,available,occupied)
        if(previous>=0&&previous!==this._physicalGamepadId){
            this.neutralPending=true
            this.stopRumble()
        }
    }

    onGamepadConnected(_event:GamepadEvent){
        this.detectActiveGamepad()
    }

    onGamepadDisconnected(event:GamepadEvent){
        if(event.gamepad.index===this._physicalGamepadId){
            this._physicalGamepadId=-1
            this.neutralPending=true
            this.stopRumble()
        }
    }

    pressGuide(){
        return Boolean(this._player&&this._isFocused&&this.guidePulse.request())
    }

    hasOverrideButtons(){
        return Object.keys(this._gamepadOverride.buttons).length > 0 || Object.keys(this.virtualAxes).length > 0 || this.virtualReleasePending || this.guidePulse.pending || this.keyboardState.pending
    }

    getGamepadState(){
        // Browsers and handheld drivers may miss hotplug events. Reconcile
        // when the selected controller disappears, before reading any input.
        if(this._options.enable_gamepad&&(this._physicalGamepadId<0||!this.getGamepad(this._physicalGamepadId)))this.detectActiveGamepad()
        if (this.neutralPending) { this.neutralPending = false; return { ...this.getDefaultFamepadFrame(), GamepadIndex: this._index } }
        if (!this._isFocused) return undefined
        const gamepad = this.getGamepad(this._physicalGamepadId)
        if((this._physicalGamepadId < 0 || gamepad === undefined) && (this.hasOverrideButtons() === false)){
            return undefined
        }

        const frame = this.getDefaultFamepadFrame()
        frame.GamepadIndex = this._index

        // Set buttons
        if(gamepad !== undefined){
            for(const button in this._options.gamepad_mapping){
                frame[button] = gamepad.buttons[this._options.gamepad_mapping[button]]?.value ?? 0
            }

            // Set axis
            for(const axis in this._options.gamepad_axes_mapping){
                const source = this._options.gamepad_swap_sticks ? axis.replace(/^(Left|Right)/, side => side === 'Left' ? 'Right' : 'Left') : axis
                const value = this.normaliseAxis(gamepad.axes[this._options.gamepad_axes_mapping[source]] ?? 0)
                frame[axis] = this._options.gamepad_invert_y && axis.endsWith('YAxis') ? -value : value
            }
        }

        // Virtual sources augment physical buttons. Releasing one source
        // must not overwrite another source's held input with zero.
        for(const button of Object.keys(this._gamepadOverride.buttons)){
            frame[button]=Math.max(frame[button],this._gamepadOverride.buttons[button])
        }
        for(const button of this.keyboardState.read())frame[button]=1
        if(this.guidePulse.sample(performance.now()))frame.Nexus=1
        for(const axis of Object.keys(this.virtualAxes))frame[axis]=this.virtualAxes[axis]
        this.virtualReleasePending=false

        // Start + Select Nexus menu workaround
        if(frame.View > 0 && frame.Menu > 0){
            frame.View = 0
            frame.Menu = 0

            frame.Nexus = 1
        }

        return frame
    }

    getGamepad(index = -1){
        const gamepad = navigator.getGamepads?.()[index]
        return gamepad?.connected?gamepad:undefined
    }

    getPhysicalGamepadId(){
        return this._physicalGamepadId
    }

    handleVibration(report:VibrationFrame){
        if(this._physicalGamepadId < 0){
            console.log('[Gamepad] Received a vibration report but no physical gamepad is connected')
            return
        }

        const gamepad = this.getGamepad(this._physicalGamepadId)
        if(gamepad === undefined){
            console.log('[Gamepad] Received a vibration report but no physical gamepad is connected')
            return
        }

        if(this._options.enable_vibration === false){
            return
        }

        if(!this._isFocused)return
        this.stopRumble()
        const actuator=gamepad.vibrationActuator as unknown as RumbleActuator|undefined
        const effect=resolveRumbleEffect(actuator,report)
        if(!effect)return
        const physicalId=this._physicalGamepadId
        const play=()=>{
            const current=this.getGamepad(physicalId)
            if(!this._player||!this._isFocused||this._physicalGamepadId!==physicalId||!current?.vibrationActuator)return false
            try{
                const output=current.vibrationActuator as unknown as RumbleActuator
                const resolved=resolveRumbleEffect(output,report)
                if(!resolved)return false
                void Promise.resolve(output.playEffect(resolved.type,resolved.parameters)).catch(()=>{})
            }catch{return false}
            return true
        }
        if(!play())return
        let repeats=effect.repeat
        if(repeats>0)this._rumbleInterval=setInterval(()=>{
            if(repeats<=0||!play()){this.stopRumble();return}
            if(--repeats===0)this.stopRumble()
        },effect.intervalMs)
    }

    normaliseAxis(value:number) {
        const configured = this._options.gamepad_deadzone
        const deadzone = Number.isFinite(configured) ? Math.max(0, Math.min(0.5, configured)) : 0.08
        if (!Number.isFinite(value)) return 0
        if(Math.abs(value) < deadzone) {
            return 0
        }

        value = value - Math.sign(value) * deadzone
        value /= (1.0 - deadzone)
        
        return Math.max(-1, Math.min(1, value))
    }
}