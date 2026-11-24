import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/userContext'
import { readConsoleProfiles } from '../../lib/consoleprofiles'
import type { ConsoleProfile } from '../../lib/consoleprofiles'
import { readProfiles } from '../../lib/controllerprofiles'

export default function ConsoleProfileSettings({ id, name }: { id: string; name: string }) {
    const { settings, setSettings } = useSettings()
    const { t } = useTranslation()
    const profiles = readConsoleProfiles(settings.console_profiles)
    const saved = profiles.find(item => item.consoleId === id)
    const profile: ConsoleProfile = saved || {consoleId:id,title:name,bitrate:null,renderer:'default',controllerProfile:''}
    const update = (patch: Partial<ConsoleProfile>) => {
        if (!saved && profiles.length >= 50) return
        setSettings({...settings,console_profiles:readConsoleProfiles([...profiles.filter(item=>item.consoleId!==id),{...profile,...patch,consoleId:id,title:name}])})
    }
    return <details className='gl-console-profile'>
        <summary>{t('dashboard.consoleStreamProfile')}{saved ? ' •' : ''}</summary>
        <p>{t('dashboard.consoleProfileDescription')}</p>
        {!saved && profiles.length >= 50 ? <p role='status'>{t('dashboard.consoleProfileLimit')}</p> : <>
        <label>{t('dashboard.qualityPresets')} <select value={profile.bitrate === null ? 'default' : String(profile.bitrate)} onChange={e=>update({bitrate:e.target.value==='default'?null:Number(e.target.value)})}><option value='default'>{t('dashboard.useGlobalSettings')}</option>{[0,4096,10240,20480,40960].map(value=><option key={value} value={value}>{value===0?t('settings.streaming.unlimitedLabel'):Math.round(value/1024)+' Mbps'}</option>)}</select></label>
        <label>{t('dashboard.requestedResolution')} <select value={profile.resolution ?? 'default'} onChange={e=>update({resolution:e.target.value==='720'?720:e.target.value==='1080'?1080:null})}><option value='default'>{t('dashboard.useGlobalSettings')}</option><option value='720'>720p</option><option value='1080'>1080p</option></select></label>
        <label>{t('dashboard.v3Renderer')} <select value={profile.renderer} onChange={e=>update({renderer:e.target.value as ConsoleProfile['renderer']})}><option value='default'>{t('dashboard.useGlobalSettings')}</option><option value='video'>{t('dashboard.standardVideo')}</option><option value='webgpu'>WebGPU</option></select></label>
        <label>{t('dashboard.controllerProfiles')} <select value={profile.controllerProfile} onChange={e=>update({controllerProfile:e.target.value})}><option value=''>{t('dashboard.useGlobalSettings')}</option>{readProfiles(settings.v3_controller_profiles).map(item=><option key={item.name} value={item.name}>{item.name}</option>)}</select></label>
        {saved && <button type='button' className='btn' onClick={()=>setSettings({...settings,console_profiles:profiles.filter(item=>item.consoleId!==id)})}>{t('dashboard.resetGameProfile')}</button>}
        </>}
    </details>
}
