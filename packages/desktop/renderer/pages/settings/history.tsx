import React from 'react'
import Head from 'next/head'
import Card from '../../components/ui/card'
import SettingsSidebar from '../../components/settings/sidebar'
import { useSettings } from '../../context/userContext'
import { readSessionHistory, clearSessionHistory } from '../../lib/sessionhistory'
import type { SessionRecord } from '../../lib/sessionhistory'
import { useTranslation } from 'react-i18next'

export default function History() {
    const { settings,setSettings } = useSettings()
    const { t } = useTranslation()
    const [records,setRecords] = React.useState<SessionRecord[]>([])
    const [filter,setFilter] = React.useState('all')
    const [error,setError] = React.useState(false)
    React.useEffect(()=>{setRecords(readSessionHistory())},[])
    const visible = records.filter(item=>filter==='all'||item.type===filter)
    const minutes = Math.round(visible.reduce((sum,item)=>sum+item.durationSeconds,0)/60)
    return <><Head><title>Greenlight - {t('dashboard.sessionHistory')}</title></Head><SettingsSidebar><Card>
        <h1>{t('dashboard.sessionHistory')}</h1>
        <p>{t('dashboard.historyDescription')}</p>
        <p><label htmlFor='history-enabled'>{t('dashboard.recordHistory')}</label><input id='history-enabled' type='checkbox' checked={settings.v3_session_history} onChange={e=>setSettings({...settings,v3_session_history:e.target.checked})}/></p>
        <p><label htmlFor='history-filter'>{t('dashboard.historyFilter')}</label><select id='history-filter' value={filter} onChange={e=>setFilter(e.target.value)}><option value='all'>{t('dashboard.historyAll')}</option><option value='home'>Remote Play</option><option value='cloud'>Cloud Gaming</option></select></p>
        <p>{t('dashboard.historyTotals',{count:visible.length,minutes})}</p>
        <button type='button' className='btn' disabled={!records.length} onClick={()=>{if(window.confirm(t('dashboard.clearHistoryConfirm'))){if(clearSessionHistory()){setRecords([]);setError(false)}else setError(true)}}}>{t('dashboard.clearHistory')}</button>
        {error && <p role='alert'>{t('dashboard.historyClearFailed')}</p>}
    </Card><Card>{visible.length===0?<p>{t('dashboard.historyEmpty')}</p>:<div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>{t('dashboard.historyDate')}</th><th>{t('dashboard.historyMode')}</th><th>{t('dashboard.historyDuration')}</th><th>{t('dashboard.historyOutcome')}</th><th>FPS</th><th>Mbps</th><th>RTT p95</th><th>{t('dashboard.connectionQuality')}</th></tr></thead><tbody>{visible.map((record,index)=><tr key={record.startedAt+'-'+index}><td>{new Date(record.startedAt).toLocaleString()}</td><td>{record.type==='home'?'Remote Play':'Cloud Gaming'}</td><td>{Math.floor(record.durationSeconds/60)}m {record.durationSeconds%60}s</td><td>{t('dashboard.history_'+record.outcome)}</td><td>{record.averageFps??'—'}</td><td>{record.averageBitrate??'—'}</td><td>{record.rtt95===null?'—':record.rtt95+' ms'}</td><td>{t('dashboard.quality_'+record.quality)}</td></tr>)}</tbody></table></div>}</Card></SettingsSidebar></>
}
