import {videoPresets,validateVideoFilters,videoFilterCss,sharpeningKernel,type VideoFilters} from '../../../desktop/renderer/lib/videofilters'

export const webVideoPresets=[
    {id:'neutral',label:'Neutral'},{id:'vivid',label:'Vivid'},{id:'cinema',label:'Cinema'},
    {id:'monochrome',label:'Monochrome'},{id:'clarity',label:'Clarity'},
] as const
export function selectWebVideoPreset(value:unknown):VideoFilters{
    const preset=webVideoPresets.find(item=>item.id===value)
    return validateVideoFilters(videoPresets[preset?.id??'neutral'])
}
export const webVideoSliders=[
    {key:'brightness',label:'Brightness',min:50,max:150},
    {key:'contrast',label:'Contrast',min:50,max:150},
    {key:'saturation',label:'Saturation',min:0,max:200},
    {key:'sharpening',label:'Sharpening (experimental)',min:0,max:100},
] as const
export function updateWebVideoFilter(current:VideoFilters,key:unknown,value:string):VideoFilters{
    const slider=webVideoSliders.find(item=>item.key===key)
    if(!slider||!/^(0|[1-9][0-9]{0,2})$/.test(value))return current
    const number=Number(value)
    if(number<slider.min||number>slider.max)return current
    return validateVideoFilters({...current,[slider.key]:number})
}
export function webVideoPresentation(value:unknown){
    const filters=validateVideoFilters(value)
    return {filter:videoFilterCss(filters),kernel:filters.sharpening>0?sharpeningKernel(filters.sharpening):null}
}
