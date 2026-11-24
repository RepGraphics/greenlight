import React from 'react'
import { useTranslation } from 'react-i18next'
import { validateVideoFilters, videoPresets } from '../../lib/videofilters'
import type { VideoFilters } from '../../lib/videofilters'

export default function VideoFilterControls({value,onChange}:{value:VideoFilters;onChange:(next:VideoFilters)=>void}) {
    const {t}=useTranslation()
    const filters=validateVideoFilters(value)
    const controls: {key:keyof VideoFilters;min:number;max:number}[] = [{key:'brightness',min:50,max:150},{key:'contrast',min:50,max:150},{key:'saturation',min:0,max:200},{key:'sharpening',min:0,max:100}]
    return <div className='gl-video-filter-controls'>
        <div className='gl-console-toolbar'>{Object.entries(videoPresets).map(([key,preset])=><button key={key} type='button' className='btn' onClick={()=>onChange({...preset})}>{t('dashboard.videoPreset_'+key)}</button>)}</div>
        {controls.map(({key,min,max})=><label key={key}>{t('dashboard.videoFilter_'+key)} <input type='range' min={min} max={max} step={1} value={filters[key]} onChange={event=>onChange({...filters,[key]:Number(event.target.value)})}/><span>{filters[key]}%</span></label>)}
        <small>{t('dashboard.sharpeningHint')}</small>
    </div>
}
