import xCloudPlayer from '../player'

export default class MouseKeyboard {
    private player?: xCloudPlayer
    private element?: HTMLVideoElement | HTMLCanvasElement
    private keys = new Map<string, { key: string; keyCode: number }>()
    private buttons = 0
    private locked = () => Boolean(this.element && document.pointerLockElement === this.element)

    constructor(private index: number, private sensitivity = 1) {}

    private release = () => {
        this.keys.forEach(key => this.player?._channels.input.queueKeyboardFrame({ ...key, pressed: false }))
        this.keys.clear()
        if (this.buttons) this.player?._channels.input.queueMouseFrame({ X:0, Y:0, WheelX:0, WheelY:0, Buttons:0, Relative:0 })
        this.buttons = 0
    }

    private onLock = () => { if (!this.locked()) this.release() }
    private onBlur = () => { this.release(); if (this.locked()) document.exitPointerLock() }
    private onKeyDown = (event: KeyboardEvent) => {
        if (!this.locked() || event.key === 'Escape' || event.repeat) return
        const key = { key: event.key, keyCode: event.keyCode }
        this.keys.set(event.code, key)
        this.player?._channels.input.queueKeyboardFrame({ ...key, pressed: true })
        event.preventDefault()
    }
    private onKeyUp = (event: KeyboardEvent) => {
        const key = this.keys.get(event.code)
        if (!key) return
        this.keys.delete(event.code)
        this.player?._channels.input.queueKeyboardFrame({ ...key, pressed: false })
        event.preventDefault()
    }
    private onPointer = (event: PointerEvent) => {
        if (!this.locked() || event.pointerType !== 'mouse') return
        this.buttons = event.buttons
        const sensitivity = Number.isFinite(this.sensitivity) ? Math.max(0.25, Math.min(4, this.sensitivity)) : 1
        const move = (value: number) => Math.max(-32767, Math.min(32767, Math.round(value * sensitivity)))
        this.player?._channels.input.queueMouseFrame({ X: move(event.movementX), Y: move(event.movementY), WheelX:0, WheelY:0, Buttons:this.buttons, Relative:0 })
        event.preventDefault()
    }
    private onWheel = (event: WheelEvent) => {
        if (!this.locked()) return
        const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1
        const clamp = (value: number) => Math.max(-32767, Math.min(32767, Math.round(value * scale)))
        this.player?._channels.input.queueMouseFrame({ X:0, Y:0, WheelX:clamp(event.deltaX), WheelY:clamp(event.deltaY), Buttons:this.buttons, Relative:0 })
        event.preventDefault()
    }
    private onContext = (event: Event) => { if (this.locked()) event.preventDefault() }
    private lockMouseKeyboard = async () => {
        if (!this.element || this.locked()) return
        try { await this.element.requestPointerLock() } catch { /* unsupported or rejected */ }
    }

    attach(player: xCloudPlayer) {
        this.detach()
        this.player = player
        this.element = player.getVideoElement()
        if (!this.element) return
        // Native input does not occupy a virtual controller slot.
        this.element.addEventListener('click', this.lockMouseKeyboard)
        this.element.addEventListener('contextmenu', this.onContext)
        window.addEventListener('pointermove', this.onPointer)
        window.addEventListener('pointerdown', this.onPointer)
        window.addEventListener('pointerup', this.onPointer)
        window.addEventListener('wheel', this.onWheel, { passive: false })
        window.addEventListener('keydown', this.onKeyDown)
        window.addEventListener('keyup', this.onKeyUp)
        window.addEventListener('blur', this.onBlur)
        document.addEventListener('pointerlockchange', this.onLock)
    }

    detach() {
        this.release()
        if (this.locked()) document.exitPointerLock()
        this.element?.removeEventListener('click', this.lockMouseKeyboard)
        this.element?.removeEventListener('contextmenu', this.onContext)
        window.removeEventListener('pointermove', this.onPointer)
        window.removeEventListener('pointerdown', this.onPointer)
        window.removeEventListener('pointerup', this.onPointer)
        window.removeEventListener('wheel', this.onWheel)
        window.removeEventListener('keydown', this.onKeyDown)
        window.removeEventListener('keyup', this.onKeyUp)
        window.removeEventListener('blur', this.onBlur)
        document.removeEventListener('pointerlockchange', this.onLock)
        this.element = undefined
        this.player = undefined
    }
}
