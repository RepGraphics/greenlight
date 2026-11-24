import React from 'react'
import Card from '../ui/card'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { exportBackup, parseBackup } from '../../lib/settingsbackup'
import { useTranslation } from 'react-i18next'

export default function SettingsBackup() {
    const { settings, setSettings } = useSettings()
    const { t } = useTranslation()
    const [pending,setPending] = React.useState<ReturnType<typeof parseBackup> | null>(null)
    const [status,setStatus] = React.useState('')
    const [busy,setBusy] = React.useState(false)
    const desktop = typeof window !== 'undefined' && window.Greenlight?.isWebUI() === false
    const select = async (file?: File) => {
        setPending(null); setStatus('')
        if (!file) return
        if (file.size > 1024*1024) { setStatus('backupInvalid'); return }
        try { setPending(parseBackup(await file.text())) } catch { setStatus('backupInvalid') }
    }
    const apply = async () => {
        if (!pending || !desktop || busy) return
        setBusy(true)
        try {
            const updated = {...settings,...pending}
            await Ipc.send('settings','setSettings',updated)
            setSettings(updated, false)
            setPending(null); setStatus('backupRestored')
        } catch { setStatus('backupFailed') }
        finally { setBusy(false) }
    }
    return <Card>
        <h1>{t('dashboard.settingsBackup')}</h1>
        <p>{t('dashboard.backupDescription')}</p>
        <button className='btn' type='button' onClick={()=>exportBackup(settings)}>{t('dashboard.exportSettings')}</button>
        {desktop && <p><label htmlFor='settings-backup-import'>{t('dashboard.importSettings')}</label><input id='settings-backup-import' type='file' accept='.json,application/json' disabled={busy} onChange={event=>{const file=event.target.files?.[0];event.target.value='';void select(file)}} /></p>}
        {pending && <div><p>{t('dashboard.backupConfirm',{count:Object.keys(pending).length})}</p><button className='btn btn-primary' type='button' disabled={busy} onClick={()=>void apply()}>{t('dashboard.applyBackup')}</button><button className='btn' type='button' disabled={busy} onClick={()=>setPending(null)}>{t('dashboard.cancelBackup')}</button></div>}
        {status && <p role='status'>{t('dashboard.'+status)}</p>}
    </Card>
}
