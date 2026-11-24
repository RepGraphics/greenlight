import React from 'react'
import Head from 'next/head'
import Card from '../../components/ui/card'
import SettingsSidebar from '../../components/settings/sidebar'
import NetworkGraphs from '../../components/ui/networkgraphs'
import { parseDiagnostics,diagnosticFileLimit } from '../../lib/diagnosticsimport'
import { summarizeDiagnostics } from '../../lib/streamdiagnostics'
import { useTranslation } from 'react-i18next'
export default function Diagnostics(){
    const {t}=useTranslation()
    const [report,setReport]=React.useState<ReturnType<typeof parseDiagnostics>|null>(null)
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
    return <><Head><title>Greenlight - {t('dashboard.diagnosticsViewer')}</title></Head><SettingsSidebar><Card><h1>{t('dashboard.diagnosticsViewer')}</h1><p>{t('dashboard.diagnosticsViewerHint')}</p><input type='file' accept='.json,application/json' disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)void load(file)}}/>{error&&<p role='alert'>{t('dashboard.diagnosticsImportFailed')}</p>}{report&&<p>Schema {report.schema} · {report.type} · {report.renderer}</p>}</Card>
    {report&&attempt&&summary&&<Card><label htmlFor='diagnostic-attempt'>{t('dashboard.diagnosticAttempt')}</label><select id='diagnostic-attempt' value={selected} onChange={event=>setSelected(Number(event.target.value))}>{report.attempts.map((item,index)=><option key={index} value={index}>{index+1} · {item.state}</option>)}</select><p>{attempt.reason?t('dashboard.failure_'+attempt.reason):attempt.state}</p><p>{t('dashboard.connectionQuality')}: {t('dashboard.quality_'+summary.quality)}</p><p>{t('dashboard.diagnosticSamples')}: {summary.sampleCount} / {attempt.samples.length}</p><p>FPS: {summary.averageFps??'—'} · Mbps: {summary.averageBitrate??'—'} · RTT p95: {summary.rtt95??'—'} ms · Jitter p95: {summary.jitter95??'—'} ms</p><p>{t('dashboard.diagnosticLoss')}: {summary.packetsLostDuringWindow}</p><button className='btn' disabled={!attempt.samples.length} onClick={()=>setGraphs(value=>!value)}>{t('dashboard.networkGraphs')}</button>{graphs&&<NetworkGraphs samples={attempt.samples} onClose={()=>setGraphs(false)}/>}</Card>}</SettingsSidebar></>
}
