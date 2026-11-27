export type DashboardDirection = 'up' | 'down' | 'left' | 'right'

type DashboardPad = Pick<Gamepad, 'index' | 'id' | 'axes' | 'buttons'>

export class DashboardGamepad {
    private pad?: Pick<DashboardPad, 'index' | 'id'>
    private armed = false
    private activateHeld = false
    private backHeld = false
    private previousHeld = false
    private direction?: DashboardDirection
    private repeatAt = 0

    reset() {
        this.pad = undefined
        this.armed = false
        this.activateHeld = false
        this.backHeld = false
        this.previousHeld = false
        this.direction = undefined
        this.repeatAt = 0
    }

    sample(pad: DashboardPad | undefined, now: number) {
        if (!pad) {
            this.reset()
            return
        }
        if (this.pad?.index !== pad.index || this.pad.id !== pad.id) {
            this.reset()
            this.pad = { index: pad.index, id: pad.id }
        }

        const pressed = (index: number) => Boolean(pad.buttons[index]?.pressed)
        const [x = 0, y = 0] = pad.axes
        const direction: DashboardDirection | undefined = pressed(12) || y < -.65 ? 'up'
            : pressed(13) || y > .65 ? 'down'
                : pressed(14) || x < -.65 ? 'left'
                    : pressed(15) || x > .65 ? 'right' : undefined
        const a = pressed(0)
        const b = pressed(1)
        const xButton = pressed(2)

        // Ignore input carried across a page, focus or controller change.
        if (!this.armed) {
            this.armed = !direction && !a && !b && !xButton
            return
        }

        const activate = a && !this.activateHeld
        const back = b && !this.backHeld
        const previous = xButton && !this.previousHeld
        this.activateHeld = a
        this.backHeld = b
        this.previousHeld = xButton
        const move = direction && (direction !== this.direction || now >= this.repeatAt)
        if (move) this.repeatAt = now + (direction === this.direction ? 140 : 350)
        this.direction = direction
        if (!move && !activate && !back && !previous) return

        return { direction: move ? direction : undefined, activate, back, previous }
    }
}
