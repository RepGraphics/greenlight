import type { GameProfile } from './gameprofiles'
export type ConsoleProfile = Omit<GameProfile,'titleId'> & { consoleId: string }
export function readConsoleProfiles(value: unknown): ConsoleProfile[] {
    if (!Array.isArray(value)) return []
    return value.filter(item => item && typeof item.consoleId === 'string' && item.consoleId.length > 0 && item.consoleId.length <= 200).slice(0,50).map(item => ({
        consoleId: item.consoleId, title: typeof item.title === 'string' ? item.title.slice(0,150) : item.consoleId,
        bitrate: typeof item.bitrate === 'number' && Number.isFinite(item.bitrate) ? Math.max(0,Math.min(40960,Math.floor(item.bitrate))) : null,
        renderer: item.renderer === 'video' || item.renderer === 'webgpu' ? item.renderer : 'default',
        controllerProfile: typeof item.controllerProfile === 'string' ? item.controllerProfile.slice(0,40) : '',
    }))
}
