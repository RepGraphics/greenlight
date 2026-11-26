import {controllerPresets,snapshotProfile,type ControllerProfile} from '../../../desktop/renderer/lib/controllerprofiles'

export const webControllerPresets=controllerPresets
export type WebControllerPreset=keyof typeof webControllerPresets
export function selectWebControllerPreset(value:unknown):ControllerProfile{
    const key=typeof value==='string'&&Object.prototype.hasOwnProperty.call(webControllerPresets,value)?value as WebControllerPreset:'standard'
    const preset=webControllerPresets[key]
    return snapshotProfile(preset.name,preset)
}
export function parseWebDeadzone(value:string):number|null{
    if(!/^(?:0|[1-9][0-9]?)$/.test(value))return null
    const percent=Number(value)
    return percent<=50?percent/100:null
}
export function webControllerOptions(profile:ControllerProfile,vibration:boolean,consolePaired:boolean){
    // The profile is validated when selected or updated; preserve the mapping
    // identity across unrelated renders to avoid reattaching controller drivers.
    return {
        deadzone:profile.v3_deadzone,
        invertY:profile.v3_invert_y,
        swapSticks:profile.v3_swap_sticks,
        buttonMapping:profile.v3_button_mapping,
        vibration:!consolePaired&&vibration,
    }
}
export function parseWebVolume(value:string):number|null{
    if(!/^(?:0|[1-9][0-9]?|100)$/.test(value))return null
    return Number(value)/100
}
