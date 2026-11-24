import type { ConsoleProfile } from '../lib/consoleprofiles'
import type { GameProfile } from '../lib/gameprofiles'
import type { ControllerProfile } from '../lib/controllerprofiles'

export const defaultSettings = {
    streaming_engine: 'legacy',
    v3_renderer: 'video',
    v3_native_mkb: false,
    v3_deadzone: 0.08,
    v3_invert_y: false,
    v3_swap_sticks: false,
    v3_mouse_sensitivity: 1,
    v3_button_mapping: {} as Record<string, string>,
    v3_controller_profiles: [] as ControllerProfile[],
    v3_game_profiles: [] as GameProfile[],
    console_profiles: [] as ConsoleProfile[],
    xhome_bitrate: 0,
    xcloud_bitrate: 0,
    xcloud_show_non_entitled: true,
    video_profiles: [],
    preferred_game_language: 'en-US',
    controller_vibration: true,
    video_size: 'default',
    force_region_ip: '',
    input_touch: false,
    input_mousekeyboard: false,
    input_mousekeyboard_config: {
        ArrowLeft: 'DPadLeft',
        ArrowUp: 'DPadUp',
        ArrowRight: 'DPadRight',
        ArrowDown: 'DPadDown',

        Enter: 'A',
        a: 'A',

        Backspace: 'B',
        b: 'B',

        x: 'X',
        y: 'Y',

        '[': 'LeftShoulder',
        ']': 'RightShoulder',

        '-': 'LeftTrigger',
        '=': 'RightTrigger',

        v: 'View',
        m: 'Menu',
        n: 'Nexus',
    },
    input_newgamepad: false,
    app_lowresolution: false,
    handheld_mode: 'auto',
    stream_performance_hud: false,

    video_enabled: true,
    audio_enabled: true,

    // WebUI
    webui_autostart: false,
    webui_port: 9003,

    // Selected language for i18n
    language: 'en-US',
}
