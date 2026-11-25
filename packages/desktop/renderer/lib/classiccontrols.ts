// Keep the Classic toolbar reachable on touch devices and while keyboard
// focus, a dialog, or the pointer is inside it. Match V3's idle timeout.
export const classicControlsIdleMs=3500
export function classicControlsVisible(state:{connected:boolean;pinned:boolean;hovered:boolean;focused:boolean;dialog:boolean;idleMs:number}):boolean{
    return !state.connected||state.pinned||state.hovered||state.focused||state.dialog||
        !Number.isFinite(state.idleMs)||state.idleMs<0||state.idleMs<classicControlsIdleMs
}
