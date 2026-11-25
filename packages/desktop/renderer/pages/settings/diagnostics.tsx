import React from 'react'
import Head from 'next/head'
import Card from '../../components/ui/card'
import SettingsSidebar from '../../components/settings/sidebar'
import NetworkGraphs from '../../components/ui/networkgraphs'
import { parseDiagnostics,diagnosticFileLimit } from '../../lib/diagnosticsimport'
import { compareDiagnostics } from '../../lib/diagnosticscompare'
import { summarizeDiagnostics } from '../../lib/streamdiagnostics'
import { useTranslation } from 'react-i18next'
export default function Diagnostics(){
    const {t}=useTranslation()
    const [report,setReport]=React.useState<ReturnType<typeof parseDiagnostics>|null>(null)
    const [baseline,setBaseline]=React.useState<ReturnType<typeof parseDiagnostics>|null>(null)
    const [baselineIndex,setBaselineIndex]=React.useState(0)
    const [baselineError,setBaselineError]=React.useState(false)
    const [baselineBusy,setBaselineBusy]=React.useState(false)
    const loadBaseline=async(file:File)=>{setBaselineBusy(true);setBaselineError(false);try{if(file.size>diagnosticFileLimit)throw Error('Too large');const value=parseDiagnostics(await file.text());setBaseline(value);setBaselineIndex(value.attempts.length-1)}catch{setBaseline(null);setBaselineError(true)}finally{setBaselineBusy(false)}}
    const [selected,setSelected]=React.useState(0)
    const [error,setError]=React.useState(false)
    const [busy,setBusy]=React.useState(false)
    const [graphs,setGraphs]=React.useState(false)
    const load=async(file:File)=>{
        setBusy(true);setError(false);setGraphs(false)
        try{if(file.size>diagnosticFileLimit)throw Error('Too large');const value=parseDiagnostics(await file.text());setReport(value);setSelected(value.attempts.length-1)}catch{setReport(null);setError(true)}finally{setBusy(false)}
    }
    const attempt=report?.attempts[selected]
    const summary=attempt?summarizeDiagnostics(attempt.samples):null
    const comparison=attempt&&baseline?compareDiagnostics(baseline.attempts[baselineIndex].samples,attempt.samples):null
    return <><Head><title>Greenlight - {t('dashboard.diagnosticsViewer')}</title></Head><SettingsSidebar><Card><h1>{t('dashboard.diagnosticsViewer')}</h1><p>{t('dashboard.diagnosticsViewerHint')}</p><input type='file' accept='.json,application/json' disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void load(file)}}/>{error&&<p role='alert'>{t('dashboard.diagnosticsImportFailed')}</p>}{report&&<p>Schema {report.schema} · {report.engine==='classic'?'Classic':'V3'} · {report.type} · {report.renderer}</p>}</Card>
    {report&&attempt&&summary&&<Card><label htmlFor='diagnostic-attempt'>{t('dashboard.diagnosticAttempt')}</label><select id='diagnostic-attempt' value={selected} onChange={event=>setSelected(Number(event.target.value))}>{report.attempts.map((item,index)=><option key={index} value={index}>{index+1} · {item.state}</option>)}</select><p>{attempt.reason?t('dashboard.failure_'+attempt.reason,{defaultValue:attempt.reason}):attempt.state}</p><p>{t('dashboard.connectionQuality')}: {t('dashboard.quality_'+summary.quality)}</p><p>{t('dashboard.diagnosticSamples')}: {summary.sampleCount} / {attempt.samples.length}</p><p>FPS: {summary.averageFps??'—'} · Mbps: {summary.averageBitrate??'—'} · RTT p95: {summary.rtt95??'—'} ms · Jitter p95: {summary.jitter95??'—'} ms</p><p>{t('dashboard.diagnosticLoss')}: {summary.packetsLostDuringWindow}</p><button className='btn' disabled={!attempt.samples.length} onClick={()=>setGraphs(value=>!value)}>{t('dashboard.networkGraphs')}</button>{graphs&&<NetworkGraphs inline samples={attempt.samples} onClose={()=>setGraphs(false)}/>}</Card>}{report&&<Card><h2>{t('dashboard.compareDiagnostics')}</h2><p>{t('dashboard.compareDiagnosticsHint')}</p><label>{t('dashboard.diagnosticBaseline')} <input type='file' accept='.json,application/json' disabled={baselineBusy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void loadBaseline(file)}}/></label>{baselineError&&<p role='alert'>{t('dashboard.diagnosticsImportFailed')}</p>}{baseline&&comparison&&<><p>{baseline.engine==='classic'?'Classic':'V3'} · {baseline.type} · {baseline.renderer}</p><label>{t('dashboard.diagnosticAttempt')} <select value={baselineIndex} onChange={e=>setBaselineIndex(Number(e.target.value))}>{baseline.attempts.map((item,index)=><option key={index} value={index}>{index+1} · {item.state}</option>)}</select></label><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>{t('dashboard.diagnosticMetric')}</th><th>{t('dashboard.diagnosticBaseline')}</th><th>{t('dashboard.diagnosticCurrent')}</th><th>{t('dashboard.diagnosticDelta')}</th></tr></thead><tbody>{comparison.metrics.map(metric=><tr key={metric.key}><td>{t('dashboard.compare_'+metric.key)}</td><td>{metric.before===null?'—':metric.before+' '+metric.unit}</td><td>{metric.after===null?'—':metric.after+' '+metric.unit}</td><td>{metric.delta===null?'—':(metric.delta>0?'+':'')+metric.delta+' '+metric.unit}</td></tr>)}</tbody></table></div><button className='btn' onClick={()=>setBaseline(null)}>{t('dashboard.dismiss')}</button></>}</Card>}</SettingsSidebar></>
}
