import React from 'react'
import {useTranslation} from 'react-i18next'
import {useSettings} from '../../context/userContext'
import {appearanceThemes,appearanceAccents,normalizeAppearance} from '../../lib/appearance'
import Card from '../ui/card'

export default function AppearanceSettings(){
    const {settings,setSettings}=useSettings()
    const {t}=useTranslation()
    const {theme,accent}=normalizeAppearance(settings.appearance_theme,settings.appearance_accent)
    return <Card><h1>{t('dashboard.appearance')}</h1><p>{t('dashboard.appearanceHint')}</p>
        <p><label htmlFor='appearance-theme'>{t('dashboard.appearanceTheme')}</label><select id='appearance-theme' value={theme} onChange={event=>setSettings({...settings,appearance_theme:normalizeAppearance(event.target.value,accent).theme})}>{appearanceThemes.map(value=><option key={value} value={value}>{t('dashboard.appearanceTheme_'+value)}</option>)}</select></p>
        <p><label htmlFor='appearance-accent'>{t('dashboard.appearanceAccent')}</label><select id='appearance-accent' value={accent} onChange={event=>setSettings({...settings,appearance_accent:normalizeAppearance(theme,event.target.value).accent})}>{appearanceAccents.map(value=><option key={value} value={value}>{t('dashboard.appearanceAccent_'+value)}</option>)}</select></p>
        <span className='btn btn-primary' aria-hidden='true'>{t('dashboard.appearance')}</span> <button type='button' className='btn' onClick={()=>setSettings({...settings,appearance_theme:'graphite',appearance_accent:'green'})}>{t('dashboard.appearanceReset')}</button>
    </Card>
}
