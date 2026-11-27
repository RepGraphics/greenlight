import {snapshotProfile,type ControllerProfile} from '../../../desktop/renderer/lib/controllerprofiles'
import {validSessionBitrate} from '../../../desktop/renderer/lib/sessionquality'
import {validateVideoFilters,type VideoFilters} from '../../../desktop/renderer/lib/videofilters'
import type {WebTouchMode} from './sessionoptions'
import {preferredControllerProfile,preferredStreamQuality,type StreamPreferences} from '../../shared/streampreferences'

export type WebSetupMode='home'|'cloud'
export type WebSetupPreferences={
    resolution:720|1080;bitrate:number;profile:ControllerProfile;vibration:boolean;
    touch:WebTouchMode;keyboard:boolean;multipleControllers:boolean;consolePaired:boolean;
    volume:number;showStats:boolean;filters:VideoFilters
}
export type WebSetupPresets=Record<WebSetupMode,WebSetupPreferences|null>
export const emptyWebSetupPresets=():WebSetupPresets=>({home:null,cloud:null})
export function snapshotWebSetup(mode:WebSetupMode,input:unknown):WebSetupPreferences{
    const v=(input&&typeof input==='object'&&!Array.isArray(input)?input:{}) as Partial<WebSetupPreferences>
    const consolePaired=mode==='home'&&v.consolePaired===true
    return {
        resolution:v.resolution===720?720:1080,
        bitrate:validSessionBitrate(v.bitrate)?v.bitrate:0,
        profile:snapshotProfile('Custom',v.profile&&typeof v.profile==='object'?v.profile:{}),
        vibration:v.vibration!==false,
        touch:!consolePaired&&(v.touch==='controller'||v.touch==='direct')?v.touch:'off',
        keyboard:!consolePaired&&v.keyboard===true,
        multipleControllers:v.multipleControllers!==false,
        consolePaired,
        volume:typeof v.volume==='number'&&Number.isFinite(v.volume)?Math.min(1,Math.max(0,v.volume)):1,
        showStats:v.showStats!==false,
        filters:validateVideoFilters(v.filters),
    }
}
export function rememberWebSetup(current:WebSetupPresets,mode:WebSetupMode,value:unknown):WebSetupPresets{
    return {...current,[mode]:snapshotWebSetup(mode,value)}
}
export function forgetWebSetup(current:WebSetupPresets,mode:WebSetupMode):WebSetupPresets{
    return {...current,[mode]:null}
}

export function deviceWebSetup(mode:WebSetupMode,preferences:StreamPreferences){
    return snapshotWebSetup(mode,{
        ...preferredStreamQuality(preferences,mode),
        profile:preferredControllerProfile(preferences),
        vibration:preferences.vibration,touch:preferences.touch,keyboard:preferences.keyboard,
        multipleControllers:preferences.multipleControllers,consolePaired:preferences.consolePaired,
        volume:preferences.volume,showStats:preferences.showStats,filters:preferences.videoFilters,
    })
}
export function resolveWebSetup(mode:WebSetupMode,preferences:StreamPreferences,remembered:WebSetupPresets){
    return remembered[mode]?snapshotWebSetup(mode,remembered[mode]):deviceWebSetup(mode,preferences)
}
