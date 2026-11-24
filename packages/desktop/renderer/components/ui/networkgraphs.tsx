import React from 'react'
import type { DiagnosticSample } from '../../lib/streamdiagnostics'
import { useTranslation } from 'react-i18next'

function Graph({samples,metric,label,unit}:{samples:DiagnosticSample[];metric:'rtt'|'jitter'|'fps'|'bitrate';label:string;unit:string}){
    const valid=samples.filter(s=>s.statsFresh!==false&&s.width>0&&s.height>0&&Number.isFinite(s[metric])&&(metric!=='rtt'||s.rtt>0))
    const end=samples[samples.length-1]?.elapsedSeconds??0
    const start=Math.max(0,end-60)
    const max=Math.max(1,...valid.map(s=>s[metric]))
    const points=valid.map(s=>((s.elapsedSeconds-start)/Math.max(1,end-start)*240).toFixed(1)+','+(74-s[metric]/max*64).toFixed(1)).join(' ')
    const last=samples[samples.length-1]?.statsFresh===false?undefined:valid[valid.length-1]?.[metric]
    return <div className='gl-network-graph'><div><strong>{label}</strong><span>{last===undefined?'—':last.toFixed(1)+' '+unit}</span></div><svg viewBox='0 0 240 80' role='img' aria-label={label+' '+unit}><path d='M0 10H240 M0 42H240 M0 74H240' stroke='currentColor' opacity='.15' fill='none'/>{valid.length>1&&<polyline points={points} stroke='#9bf00b' strokeWidth='1.8' vectorEffect='non-scaling-stroke' fill='none'/>}</svg><small>0 – {max.toFixed(1)} {unit}</small></div>
}
export default function NetworkGraphs({samples,onClose}:{samples:DiagnosticSample[];onClose:()=>void}){
    const {t}=useTranslation()
    const end=samples[samples.length-1]?.elapsedSeconds??0
    const recent=samples.filter(s=>s.elapsedSeconds>=end-60)
    return <aside className='gl-network-panel' aria-label={t('dashboard.networkGraphs')}><header><h2>{t('dashboard.networkGraphs')}</h2><button className='btn' type='button' onClick={onClose}>{t('dashboard.dismiss')}</button></header><p>{t('dashboard.networkGraphWindow')}</p><div className='gl-network-grid'><Graph samples={recent} metric='rtt' label='RTT' unit='ms'/><Graph samples={recent} metric='jitter' label='Jitter' unit='ms'/><Graph samples={recent} metric='fps' label='FPS' unit='fps'/><Graph samples={recent} metric='bitrate' label={t('dashboard.averageBitrate')} unit='Mbps'/></div></aside>
}
