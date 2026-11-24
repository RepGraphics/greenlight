export interface GameProfile {
    titleId: string
    title: string
    bitrate: number | null
    resolution?: 720 | 1080 | null
    renderer: 'default' | 'video' | 'webgpu'
    controllerProfile: string
}
export function readGameProfiles(value: unknown): GameProfile[] {
    if (!Array.isArray(value)) return []
    return value.filter(item => item && typeof item.titleId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(item.titleId)).slice(0,100).map(item => ({
        titleId: item.titleId, title: typeof item.title === 'string' ? item.title.slice(0,150) : item.titleId,
        bitrate: typeof item.bitrate === 'number' && Number.isFinite(item.bitrate) ? Math.max(0,Math.min(40960,Math.floor(item.bitrate))) : null,
        resolution: item.resolution === 720 || item.resolution === 1080 ? item.resolution : null,
        renderer: item.renderer === 'video' || item.renderer === 'webgpu' ? item.renderer : 'default',
        controllerProfile: typeof item.controllerProfile === 'string' ? item.controllerProfile.slice(0,40) : '',
    }))
}
