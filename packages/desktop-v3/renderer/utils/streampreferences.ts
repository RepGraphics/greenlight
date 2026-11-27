import {validSessionBitrate} from '../../../desktop/renderer/lib/sessionquality'
import {webControllerPresets, type WebControllerPreset} from './controlleroptions'

export const preferencesKey = 'greenlight.v3.stream-preferences'

export interface StreamPreferences {
    resolution: 720 | 1080
    bitrate: number
    showStats: boolean
    multipleControllers: boolean
    keyboard: boolean
    vibration: boolean
    preset: WebControllerPreset
    deadzone: number | null
}

export const defaultStreamPreferences: StreamPreferences = {
    resolution: 1080, bitrate: 0, showStats: true, multipleControllers: true,
    keyboard: false, vibration: true, preset: 'standard', deadzone: null,
}

export function normalizeStreamPreferences(input: unknown): StreamPreferences {
    const value = input && typeof input === 'object' ? input as Partial<StreamPreferences> : {}
    const defaults = defaultStreamPreferences
    return {
        resolution: value.resolution === 720 ? 720 : defaults.resolution,
        bitrate: validSessionBitrate(value.bitrate) ? value.bitrate : defaults.bitrate,
        showStats: typeof value.showStats === 'boolean' ? value.showStats : defaults.showStats,
        multipleControllers: typeof value.multipleControllers === 'boolean' ? value.multipleControllers : defaults.multipleControllers,
        keyboard: typeof value.keyboard === 'boolean' ? value.keyboard : defaults.keyboard,
        vibration: typeof value.vibration === 'boolean' ? value.vibration : defaults.vibration,
        preset: value.preset && Object.prototype.hasOwnProperty.call(webControllerPresets, value.preset) ? value.preset : defaults.preset,
        deadzone: typeof value.deadzone === 'number' && value.deadzone >= 0 && value.deadzone <= .5 ? value.deadzone : defaults.deadzone,
    }
}
