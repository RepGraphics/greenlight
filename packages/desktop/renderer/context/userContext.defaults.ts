import defaults from '../../shared/settings-defaults.json'
import type { ConsoleProfile } from '../lib/consoleprofiles'
import type { GameProfile } from '../lib/gameprofiles'
import type { ControllerProfile } from '../lib/controllerprofiles'

export const defaultSettings = {
    ...defaults,
    v3_button_mapping: defaults.v3_button_mapping as Record<string, string>,
    v3_controller_profiles: defaults.v3_controller_profiles as ControllerProfile[],
    v3_game_profiles: defaults.v3_game_profiles as GameProfile[],
    console_profiles: defaults.console_profiles as ConsoleProfile[],
    video_profiles: defaults.video_profiles as string[],
}
