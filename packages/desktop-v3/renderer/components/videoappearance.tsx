import {webVideoPresets,webVideoSliders,selectWebVideoPreset,updateWebVideoFilter} from '../utils/videoappearance'
import type {VideoFilters} from '../../../desktop/renderer/lib/videofilters'

export default function VideoAppearance({value,onChange}:{value:VideoFilters;onChange:(value:VideoFilters)=>void}){
    const button='rounded border border-white/20 px-3 py-2'
    return <details className="my-3 rounded border border-white/10 p-3">
        <summary className="cursor-pointer font-semibold">Video appearance</summary>
        <div className="flex flex-wrap gap-2 mt-3">
            {webVideoPresets.map(preset=><button type="button" key={preset.id} className={button} onClick={()=>onChange(selectWebVideoPreset(preset.id))}>{preset.label}</button>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            {webVideoSliders.map(slider=><label key={slider.key} className="flex flex-col gap-1">{slider.label}: {value[slider.key]}%<input type="range" min={slider.min} max={slider.max} step="1" value={value[slider.key]} onChange={event=>onChange(updateWebVideoFilter(value,slider.key,event.target.value))}/></label>)}
        </div>
        <p className="text-sm text-white/60 mt-3">These local SDR filters change only the displayed game video, not the Xbox stream, touch layout or downloaded captures. Sharpening depends on browser support and may increase rendering cost. Select Neutral to reset.</p>
    </details>
}
