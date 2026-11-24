import { validateButtonMapping } from '../../../player/src/client/lib/input/mapping'

export interface ControllerProfile {
    name: string
    v3_deadzone: number
    v3_invert_y: boolean
    v3_swap_sticks: boolean
    v3_mouse_sensitivity: number
    v3_button_mapping: Record<string,string>
}
export function snapshotProfile(name: string, settings: Partial<ControllerProfile>): ControllerProfile {
    const clamp = (value: unknown, min: number, max: number, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
    return { name: name.trim().slice(0,40), v3_deadzone:clamp(settings.v3_deadzone,0,0.5,0.08), v3_invert_y:settings.v3_invert_y === true, v3_swap_sticks:settings.v3_swap_sticks === true, v3_mouse_sensitivity:clamp(settings.v3_mouse_sensitivity,0.25,4,1), v3_button_mapping:validateButtonMapping(settings.v3_button_mapping) }
}
export function readProfiles(value: unknown): ControllerProfile[] {
    if (!Array.isArray(value)) return []
    return value.filter(item => item && typeof item.name === 'string' && item.name.trim()).slice(0,20).map(item => snapshotProfile(item.name,item))
}
export const controllerPresets = {
    standard: snapshotProfile('Standard', {}),
    southpaw: snapshotProfile('Southpaw', { v3_swap_sticks:true }),
    inverted: snapshotProfile('Inverted', { v3_invert_y:true }),
    alternate: snapshotProfile('Alternate face buttons', { v3_button_mapping: { A:'1', B:'0', X:'3', Y:'2' } }),
}
