import React from 'react'
import {useTranslation} from 'react-i18next'
import {useSettings} from '../../context/userContext'
import Card from '../ui/card'

export default function DiscordPresenceSettings(){
    const {settings,setSettings}=useSettings()
    const {t}=useTranslation()
    const [desktop,setDesktop]=React.useState(false)
    React.useEffect(()=>setDesktop(window.Greenlight?.isWebUI()===false),[])
    if(!desktop)return null
    const id=typeof settings.discord_application_id==='string'?settings.discord_application_id:''
    const valid=/^[1-9][0-9]{16,19}$/.test(id)
    return <Card><h1>{t('dashboard.discordPresence')}</h1><p>{t('dashboard.discordPresenceHint')}</p>
        <p><label htmlFor='discord-application-id'>{t('dashboard.discordApplicationId')}</label><input id='discord-application-id' className='text' type='text' inputMode='numeric' maxLength={20} value={id} onChange={event=>{const next=event.target.value.replace(/[^0-9]/g,'').slice(0,20);setSettings({...settings,discord_application_id:next,discord_presence_enabled:false})}}/></p>
        <p><label><input type='checkbox' disabled={!valid} checked={valid&&settings.discord_presence_enabled===true} onChange={event=>setSettings({...settings,discord_presence_enabled:event.target.checked})}/> {t('dashboard.discordPresenceEnable')}</label></p>
        <button type='button' className='btn' onClick={()=>window.Greenlight.openExternal('https://discord.com/developers/applications')}>Discord Developer Portal</button>
    </Card>
}
