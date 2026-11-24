import { validateVideoFilters } from './videofilters'
import type { defaultSettings } from '../context/userContext.defaults'
import { readProfiles, snapshotProfile } from './controllerprofiles'
import { readGameProfiles } from './gameprofiles'
import { readConsoleProfiles } from './consoleprofiles'
import { defaultButtonMapping } from '../../../player/src/client/lib/input/mapping'

type Settings = typeof defaultSettings
const boolKeys = ['v3_session_history','v3_native_mkb','v3_invert_y','v3_swap_sticks','xcloud_show_non_entitled','controller_vibration','input_touch','input_mousekeyboard','input_newgamepad','app_lowresolution','stream_performance_hud','video_enabled','audio_enabled'] as const
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {}
export function portableSettings(value: unknown): Partial<Settings> {
    const raw = object(value)
    const result: Partial<Settings> = {}
    for (const key of boolKeys) if (typeof raw[key] === 'boolean') result[key] = raw[key] as boolean
    const number = (key: 'xhome_bitrate'|'xcloud_bitrate'|'v3_deadzone'|'v3_mouse_sensitivity', min:number,max:number) => {
        const v = raw[key]
        if (typeof v === 'number' && Number.isFinite(v)) result[key] = Math.max(min,Math.min(max,v))
    }
    number('xhome_bitrate',0,40960); number('xcloud_bitrate',0,40960); number('v3_deadzone',0,0.5); number('v3_mouse_sensitivity',0.25,4)
    if (raw.streaming_engine === 'legacy' || raw.streaming_engine === 'experimental') result.streaming_engine = raw.streaming_engine
    if (raw.v3_video_filters && typeof raw.v3_video_filters === 'object') result.v3_video_filters = validateVideoFilters(raw.v3_video_filters)
    if (raw.v3_renderer === 'video' || raw.v3_renderer === 'webgpu') result.v3_renderer = raw.v3_renderer
    if (raw.video_size === 'default' || raw.video_size === 'stretch' || raw.video_size === 'zoom') result.video_size = raw.video_size
    if (raw.handheld_mode === 'auto' || raw.handheld_mode === 'on' || raw.handheld_mode === 'off') result.handheld_mode = raw.handheld_mode
    for (const key of ['language','preferred_game_language'] as const) if (typeof raw[key] === 'string' && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(raw[key])) result[key] = raw[key]
    if (Array.isArray(raw.video_profiles)) result.video_profiles = raw.video_profiles.filter(item => item === '4d' || item === '42e' || item === '420').slice(0,3)
    if (raw.v3_button_mapping && typeof raw.v3_button_mapping === 'object') result.v3_button_mapping = snapshotProfile('',{v3_button_mapping:object(raw.v3_button_mapping) as Record<string,string>}).v3_button_mapping
    if (Array.isArray(raw.v3_controller_profiles)) result.v3_controller_profiles = readProfiles(raw.v3_controller_profiles)
    if (Array.isArray(raw.v3_game_profiles)) result.v3_game_profiles = readGameProfiles(raw.v3_game_profiles)
    if (Array.isArray(raw.console_profiles)) result.console_profiles = readConsoleProfiles(raw.console_profiles)
    if (raw.input_mousekeyboard_config && typeof raw.input_mousekeyboard_config === 'object') {
        const entries = Object.entries(object(raw.input_mousekeyboard_config)).filter(([key,button]) => key.length <= 40 && key !== '__proto__' && key !== 'constructor' && key !== 'prototype' && typeof button === 'string' && Object.prototype.hasOwnProperty.call(defaultButtonMapping,button)).slice(0,200)
        result.input_mousekeyboard_config = Object.fromEntries(entries) as Settings['input_mousekeyboard_config']
    }
    return result
}
export function parseBackup(text: string): Partial<Settings> {
    const backup = object(JSON.parse(text))
    if (backup.format !== 'greenlight-settings' || backup.version !== 1) throw new Error('Unsupported backup format')
    const settings = portableSettings(backup.settings)
    if (!Object.keys(settings).length) throw new Error('No valid settings')
    return settings
}
export function exportBackup(settings: Settings) {
    const backup = { format:'greenlight-settings',version:1,settings:portableSettings(settings) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}))
    const link = document.createElement('a')
    link.href=url; link.download='greenlight-settings.json'; document.body.appendChild(link); link.click(); link.remove()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
}
