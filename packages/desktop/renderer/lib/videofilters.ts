export interface VideoFilters { brightness:number; contrast:number; saturation:number }
export const neutralFilters: VideoFilters = {brightness:100,contrast:100,saturation:100}
export function validateVideoFilters(value: unknown): VideoFilters {
    const raw = value && typeof value === 'object' ? value as Partial<VideoFilters> : {}
    const clamp = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(min,Math.min(max,v))) : 100
    return {brightness:clamp(raw.brightness,50,150),contrast:clamp(raw.contrast,50,150),saturation:clamp(raw.saturation,0,200)}
}
export const videoPresets: Record<string,VideoFilters> = {
    neutral: neutralFilters, vivid:{brightness:105,contrast:110,saturation:125}, cinema:{brightness:95,contrast:115,saturation:90}, monochrome:{brightness:100,contrast:100,saturation:0}
}
export function videoFilterCss(value: unknown) {
    const f = validateVideoFilters(value)
    return 'brightness('+f.brightness+'%) contrast('+f.contrast+'%) saturate('+f.saturation+'%)'
}
