export interface VideoFilters { brightness:number; contrast:number; saturation:number; sharpening:number }
export const neutralFilters: VideoFilters = {brightness:100,contrast:100,saturation:100,sharpening:0}
export function validateVideoFilters(value: unknown): VideoFilters {
    const raw = value && typeof value === 'object' ? value as Partial<VideoFilters> : {}
    const clamp = (v: unknown, min: number, max: number, fallback = 100) => typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(min,Math.min(max,v))) : fallback
    return {brightness:clamp(raw.brightness,50,150),contrast:clamp(raw.contrast,50,150),saturation:clamp(raw.saturation,0,200),sharpening:clamp(raw.sharpening,0,100,0)}
}
export const videoPresets: Record<string,VideoFilters> = {
    neutral: neutralFilters, vivid:{brightness:105,contrast:110,saturation:125,sharpening:0}, cinema:{brightness:95,contrast:115,saturation:90,sharpening:0}, monochrome:{brightness:100,contrast:100,saturation:0,sharpening:0}, clarity:{brightness:100,contrast:100,saturation:100,sharpening:25}
}
export function sharpeningKernel(value: unknown): string {
    const amount=validateVideoFilters({sharpening:value}).sharpening/200
    return [0,-amount,0,-amount,1+4*amount,-amount,0,-amount,0].join(' ')
}
export function videoFilterCss(value: unknown) {
    const f = validateVideoFilters(value)
    const colors = 'brightness('+f.brightness+'%) contrast('+f.contrast+'%) saturate('+f.saturation+'%)'
    return f.sharpening > 0 ? colors+' url(#gl-stream-sharpen)' : colors
}

export function classicVideoPresentation(value:unknown,display:unknown){
    const mode=display==='stretch'||display==='zoom'?display:'default'
    return {mode,className:'gl-classic-display-'+mode,filter:videoFilterCss(value)}
}
