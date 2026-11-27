import React from 'react'
import { DashboardGamepad, type DashboardDirection } from '../../lib/dashboardgamepad'

const selector = 'a[href], button, input, select, textarea, summary, [tabindex]'

function focusables(root: ParentNode) {
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(el => {
        const rect = el.getBoundingClientRect()
        return el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[inert], [hidden], [aria-hidden="true"]') &&
            rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility === 'visible'
    })
}

function move(root: ParentNode, direction: DashboardDirection) {
    const all = focusables(root)
    const current = document.activeElement as HTMLElement
    if (!all.includes(current)) {
        const initial = all.find(el => el.getAttribute('aria-current') === 'page') ?? all[0]
        initial?.focus()
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

type DashboardInputProps = {
    enabled: boolean
    onBack?: () => void
    scope?: React.RefObject<HTMLElement | null>
    keyboardNavigation?: boolean
}

function readGamepad() {
    try {
        return Array.from(navigator.getGamepads?.() ?? []).find(pad => pad?.connected && pad.mapping === 'standard') ?? undefined
    } catch {
        return undefined
    }
}

export default function DashboardInput({ enabled, onBack, scope, keyboardNavigation = true }: DashboardInputProps) {
    React.useEffect(() => {
        if (!enabled) return
        let frame = 0
        const controller = new DashboardGamepad()
        const rootNode = () => {
            const root = scope ? scope.current : document
            return root?.querySelector('dialog[open]') ?? root
        }
        const keys: Record<string, DashboardDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
            const target = event.target as HTMLElement
            if (target?.closest('input:not([type="checkbox"]):not([type="radio"]), select, textarea, [contenteditable="true"]')) return
            const direction = keys[event.key]
            const root = rootNode()
            if (root && direction) {
                event.preventDefault()
                move(root, direction)
            }
        }
        const clearFocusStyle = () => document.documentElement.classList.remove('gl-gamepad-focus')
        const resetController = () => {
            controller.reset()
            clearFocusStyle()
        }
        const tick = (now: number) => {
            frame = requestAnimationFrame(tick)
            const root = rootNode()
            if (!root || document.hidden || !document.hasFocus()) {
                resetController()
                return
            }
            const input = controller.sample(readGamepad(), now)
            if (!input) return
            const { direction, activate, back, previous } = input
            if (direction || activate) {
                document.documentElement.classList.add('gl-gamepad-focus')
            }
            if (direction) {
                const target = document.activeElement
                const horizontal = direction === 'left' || direction === 'right'
                if (!(horizontal && target instanceof HTMLElement && root.contains(target) && adjust(target, direction === 'left' ? -1 : 1))) {
                    move(root, direction)
                }
            }
            if (activate) {
                const target = document.activeElement as HTMLElement
                if (focusables(root).includes(target)) {
                    if (target.matches('a, button, summary, input[type="checkbox"], input[type="radio"]')) target.click()
                    else if (target instanceof HTMLSelectElement) adjust(target, 1)
                } else move(root, 'down')
            }
            if (back) {
                const target = document.activeElement
                if (target instanceof HTMLElement && root.contains(target) && target.matches('input, select, textarea')) target.blur()
                else if (root instanceof HTMLDialogElement) root.close()
                else onBack?.()
            }
            if (previous) {
                const target = document.activeElement
                if (target instanceof HTMLElement && root.contains(target)) adjust(target, -1)
            }
        }
        if (keyboardNavigation) window.addEventListener('keydown', onKey)
        window.addEventListener('pointerdown', clearFocusStyle)
        window.addEventListener('blur', resetController)
        document.addEventListener('visibilitychange', resetController)
        frame = requestAnimationFrame(tick)
        return () => {
            cancelAnimationFrame(frame)
            if (keyboardNavigation) window.removeEventListener('keydown', onKey)
            window.removeEventListener('pointerdown', clearFocusStyle)
            window.removeEventListener('blur', resetController)
            document.removeEventListener('visibilitychange', resetController)
            clearFocusStyle()
        }
    }, [enabled, keyboardNavigation, onBack, scope])
    return null
}
