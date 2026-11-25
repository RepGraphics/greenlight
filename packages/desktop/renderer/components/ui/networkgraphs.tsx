import React from 'react'
import type { DiagnosticSample } from '../../lib/streamdiagnostics'
import { graphData } from '../../lib/networkgraph'
import type { GraphMetric } from '../../lib/networkgraph'
import { useTranslation } from 'react-i18next'

function Graph({samples,metric,label,unit,seconds}:{samples:DiagnosticSample[];metric:GraphMetric;label:string;unit:string;seconds:number}){
    const {max,segments,last}=graphData(samples,metric,seconds)
    return <div className='gl-network-graph'><div><strong>{label}</strong><span>{last===undefined?'—':last.toFixed(1)+' '+unit}</span></div><svg viewBox='0 0 240 80' role='img' aria-label={label+' '+unit}><path d='M0 10H240 M0 42H240 M0 74H240' stroke='currentColor' opacity='.15' fill='none'/>{segments.map((points,index)=><polyline key={index} points={points} stroke='#9bf00b' strokeWidth='1.8' vectorEffect='non-scaling-stroke' fill='none'/>)}</svg><small>0 – {max.toFixed(1)} {unit}</small></div>
}
export default function NetworkGraphs({samples,onClose,inline=false}:{samples:DiagnosticSample[];onClose:()=>void;inline?:boolean}){
    const {t}=useTranslation()
    const [seconds,setSeconds]=React.useState(60)
    return <aside className={inline?'gl-network-panel gl-network-inline':'gl-network-panel'} style={inline?{position:'static',width:'100%',maxHeight:'none',transform:'none'}:undefined} aria-label={t('dashboard.networkGraphs')}><header><h2>{t('dashboard.networkGraphs')}</h2><button className='btn' type='button' onClick={onClose}>{t('dashboard.dismiss')}</button></header><label>{t('dashboard.graphWindow')} <select value={seconds} onChange={e=>setSeconds(Number(e.target.value))}>{[30,60,120,300].map(value=><option key={value} value={value}>{value} s</option>)}</select></label><p>{t('dashboard.graphGapHint')}</p><div className='gl-network-grid'><Graph samples={samples} metric='rtt' label='RTT' unit='ms' seconds={seconds}/><Graph samples={samples} metric='jitter' label='Jitter' unit='ms' seconds={seconds}/><Graph samples={samples} metric='fps' label='FPS' unit='fps' seconds={seconds}/><Graph samples={samples} metric='bitrate' label={t('dashboard.averageBitrate')} unit='Mbps' seconds={seconds}/></div></aside>
}
