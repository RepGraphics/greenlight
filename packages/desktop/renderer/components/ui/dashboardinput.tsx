import React from 'react'

type Direction = 'up' | 'down' | 'left' | 'right'
const selector = 'a[href], button, input, select, textarea, summary, [tabindex]'

function focusables() {
    return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(el => {
        const rect = el.getBoundingClientRect()
        return el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert], [hidden], [aria-hidden="true"]') &&
            rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility === 'visible'
    })
}

function move(direction: Direction) {
    const all = focusables()
    const current = document.activeElement as HTMLElement
    if (!all.includes(current)) {
        all[0]?.focus()
        return
    }
    const rect = current.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    let best: HTMLElement | undefined
    let score = Infinity
    for (const el of all) {
        if (el === current) continue
        const r = el.getBoundingClientRect()
        const dx = r.left + r.width / 2 - x
        const dy = r.top + r.height / 2 - y
        const primary = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy
        if (primary <= 4) continue
        const cross = direction === 'right' || direction === 'left' ? Math.abs(dy) : Math.abs(dx)
        const cost = Math.hypot(dx, dy) + cross * 1.5
        if (cost < score) { best = el; score = cost }
    }
    if (best) {
        best.focus({ preventScroll: true })
        best.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
}

function adjust(el: HTMLElement, direction: number) {
    if (el instanceof HTMLSelectElement) {
        const next = el.selectedIndex + direction
        if (next >= 0 && next < el.options.length && !el.options[next].disabled) {
            el.selectedIndex = next
            el.dispatchEvent(new Event('change', { bubbles: true }))
        }
        return true
    }
    if (el instanceof HTMLInputElement && el.type === 'range') {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        const value = Number(el.value) + direction * (Number(el.step) || 1)
        setter?.call(el, String(Math.min(Number(el.max || 100), Math.max(Number(el.min || 0), value))))
        el.dispatchEvent(new Event('input', { bubbles: true }))
        return true
    }
    return false
}

export default function DashboardInput({ enabled }: { enabled: boolean }) {
    React.useEffect(() => {
        if (!enabled) return
        let frame = 0
        let lastDirection: Direction | undefined
        let repeatAt = 0
        let previousA = true
        let previousB = true
        let previousX = true
        let previousPad = -1
        const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
            const target = event.target as HTMLElement
            if (target?.closest('input, select, textarea, [contenteditable="true"]')) return
            const direction = keys[event.key]
            if (direction) {
                event.preventDefault()
                move(direction)
            }
        }
        const tick = (now: number) => {
            frame = requestAnimationFrame(tick)
            if (!document.hasFocus() || document.hidden) { previousA = previousB = previousX = true; lastDirection = undefined; previousPad = -1; return }
            const pad = Array.from(navigator.getGamepads?.() || []).find(p => p?.mapping === 'standard')
            if (!pad) { previousA = previousB = previousX = true; lastDirection = undefined; previousPad = -1; return }
            if (pad.index !== previousPad) { previousPad = pad.index; previousA = previousB = previousX = true; lastDirection = undefined }
            const down = (n: number) => Boolean(pad.buttons[n]?.pressed)
            const x = pad.axes[0] || 0
            const y = pad.axes[1] || 0
            const direction: Direction | undefined = down(12) || y < -.65 ? 'up' : down(13) || y > .65 ? 'down' : down(14) || x < -.65 ? 'left' : down(15) || x > .65 ? 'right' : undefined
            if (direction && (direction !== lastDirection || now >= repeatAt)) {
                document.documentElement.classList.add('gl-gamepad-focus')
                const target = document.activeElement as HTMLElement
                if (!((direction === 'left' || direction === 'right') && adjust(target, direction === 'left' ? -1 : 1))) move(direction)
                repeatAt = now + (direction === lastDirection ? 140 : 350)
            }
            lastDirection = direction
            if (down(0) && !previousA) {
                document.documentElement.classList.add('gl-gamepad-focus')
                const target = document.activeElement as HTMLElement
                if (focusables().includes(target)) {
                    if (target.matches('a, button, summary, input[type="checkbox"], input[type="radio"]')) target.click()
                    else if (target instanceof HTMLSelectElement) adjust(target, 1)
                } else move('down')
            }
            if (down(1) && !previousB && document.activeElement instanceof HTMLElement) document.activeElement.blur()
            if (down(2) && !previousX) {
                const target = document.activeElement as HTMLElement
                adjust(target, -1)
            }
            previousA = down(0)
            previousB = down(1)
            previousX = down(2)
        }
        const mouse = () => document.documentElement.classList.remove('gl-gamepad-focus')
        window.addEventListener('keydown', onKey)
        window.addEventListener('pointerdown', mouse)
        frame = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(frame)
            window.removeEventListener('keydown', onKey)
            window.removeEventListener('pointerdown', mouse)
            mouse()
        }
    }, [enabled])
    return null
}
