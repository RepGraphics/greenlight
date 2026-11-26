import React from 'react'
import {useTranslation} from 'react-i18next'
import {parseSessionBitrate,selectableSessionBitrates,sessionBitrateLabel} from '../../lib/sessionquality'

export default function SessionQualityPicker({active,disabled,onSelect}:{active:number;disabled:boolean;onSelect:(cap:number)=>void}){
    const {t}=useTranslation()
    return <label style={{pointerEvents:'auto'}}>{t('dashboard.sessionBitrateSelect')} <select className='text' disabled={disabled} value='' onChange={event=>{
        const cap=parseSessionBitrate(event.target.value)
        if(cap!==null&&cap!==active&&!disabled)onSelect(cap)
    }}><option value='' disabled>{t('dashboard.sessionBitrateChoose')}</option>{selectableSessionBitrates(active).map(cap=><option key={cap} value={cap}>{sessionBitrateLabel(cap,t('settings.streaming.unlimitedLabel'))}</option>)}</select></label>
}
