import {validSessionBitrate} from '../../../desktop/renderer/lib/sessionquality'
import {validateVideoFilters, type VideoFilters} from '../../../desktop/renderer/lib/videofilters'
import {validateButtonMapping} from '../../../player/src/client/lib/input/mapping'
import {selectWebControllerPreset, webControllerPresets, type WebControllerPreset} from './controlleroptions'
import {type WebTouchMode} from './sessionoptions'
import {webRecordingPreferences, webReplayDurations} from './webcapture'

export const preferencesKey = 'greenlight.v3.stream-preferences'
export const streamLanguages = [
    'ar-SA', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'en-GB', 'en-US', 'es-ES', 'es-MX', 'fi-FI',
    'fr-FR', 'he-IL', 'hu-HU', 'it-IT', 'ja-JP', 'ko-KR', 'nb-NO', 'nl-NL', 'pl-PL', 'pt-BR',
    'pt-PT', 'ru-RU', 'sk-SK', 'sv-SE', 'tr-TR', 'zh-CN', 'zh-TW',
] as const

export interface StreamPreferences {
    resolution: 720 | 1080
    bitrate: number
    showStats: boolean
    multipleControllers: boolean
    keyboard: boolean
    vibration: boolean
    preset: WebControllerPreset
    deadzone: number | null
    remoteResolution: 720 | 1080 | null
    remoteBitrate: number | null
    gameLanguage: string
    volume: number
    muted: boolean
    videoFilters: VideoFilters
    consolePaired: boolean
    touch: WebTouchMode
    invertY: boolean | null
    swapSticks: boolean | null
    buttonMapping: Record<string, string> | null
    clipSeconds: number
    clipBitrate: number
    replaySeconds: number
    captureAudio: boolean
    libraryLayout: 'grid' | 'list'
    showUnavailable: boolean
}

export const defaultStreamPreferences: StreamPreferences = {
    resolution: 1080, bitrate: 0, showStats: true, multipleControllers: true,
    keyboard: false, vibration: true, preset: 'standard', deadzone: null,
    remoteResolution: null, remoteBitrate: null, gameLanguage: '',
    volume: 1, muted: false, videoFilters: validateVideoFilters(null),
    consolePaired: false, touch: 'off', invertY: null, swapSticks: null, buttonMapping: null,
    clipSeconds: 60, clipBitrate: 3000000, replaySeconds: 30, captureAudio: true,
    libraryLayout: 'grid', showUnavailable: false,
}

export function normalizeStreamPreferences(input: unknown): StreamPreferences {
    const value = input && typeof input === 'object' ? input as Partial<StreamPreferences> : {}
    const defaults = defaultStreamPreferences
    const recording = webRecordingPreferences(value.clipSeconds, value.clipBitrate)
    const booleanOrNull = (candidate: unknown) => typeof candidate === 'boolean' ? candidate : null
    return {
        resolution: value.resolution === 720 ? 720 : defaults.resolution,
        bitrate: validSessionBitrate(value.bitrate) ? value.bitrate : defaults.bitrate,
        showStats: typeof value.showStats === 'boolean' ? value.showStats : defaults.showStats,
        multipleControllers: typeof value.multipleControllers === 'boolean' ? value.multipleControllers : defaults.multipleControllers,
        keyboard: typeof value.keyboard === 'boolean' ? value.keyboard : defaults.keyboard,
        vibration: typeof value.vibration === 'boolean' ? value.vibration : defaults.vibration,
        preset: value.preset && Object.prototype.hasOwnProperty.call(webControllerPresets, value.preset) ? value.preset : defaults.preset,
        deadzone: typeof value.deadzone === 'number' && value.deadzone >= 0 && value.deadzone <= .5 ? value.deadzone : defaults.deadzone,
        remoteResolution: value.remoteResolution === 720 || value.remoteResolution === 1080 ? value.remoteResolution : null,
        remoteBitrate: validSessionBitrate(value.remoteBitrate) ? value.remoteBitrate : null,
        gameLanguage: streamLanguages.find(language => language === value.gameLanguage) ?? '',
        volume: typeof value.volume === 'number' && value.volume >= 0 && value.volume <= 1 ? value.volume : defaults.volume,
        muted: value.muted === true,
        videoFilters: validateVideoFilters(value.videoFilters),
        consolePaired: value.consolePaired === true,
        touch: value.touch === 'controller' || value.touch === 'direct' ? value.touch : 'off',
        invertY: booleanOrNull(value.invertY),
        swapSticks: booleanOrNull(value.swapSticks),
        buttonMapping: value.buttonMapping && typeof value.buttonMapping === 'object' && !Array.isArray(value.buttonMapping)
            ? validateButtonMapping(value.buttonMapping) : null,
        clipSeconds: recording.seconds,
        clipBitrate: recording.videoBitsPerSecond,
        replaySeconds: webReplayDurations.find(seconds => seconds === value.replaySeconds) ?? defaults.replaySeconds,
        captureAudio: value.captureAudio !== false,
        libraryLayout: value.libraryLayout === 'list' ? 'list' : 'grid',
        showUnavailable: value.showUnavailable === true,
    }
}

export function preferredControllerProfile(preferences: StreamPreferences) {
    const preset = selectWebControllerPreset(preferences.preset)
    return {
        ...preset,
        v3_deadzone: preferences.deadzone ?? preset.v3_deadzone,
        v3_invert_y: preferences.invertY ?? preset.v3_invert_y,
        v3_swap_sticks: preferences.swapSticks ?? preset.v3_swap_sticks,
        v3_button_mapping: preferences.buttonMapping ?? preset.v3_button_mapping,
    }
}

export function preferredStreamQuality(preferences: StreamPreferences, target: 'cloud' | 'home') {
    return {
        resolution: (target === 'home' ? preferences.remoteResolution : null) ?? preferences.resolution,
        bitrate: (target === 'home' ? preferences.remoteBitrate : null) ?? preferences.bitrate,
    }
}
