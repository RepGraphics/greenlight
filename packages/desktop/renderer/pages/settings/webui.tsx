import React from 'react'
import Head from 'next/head'
import SettingsSidebar from '../../components/settings/sidebar'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'
import Ipc from '../../lib/ipc'
import { useSettings } from '../../context/userContext'
import { useTranslation } from 'react-i18next'


function SettingsWebUI() {
    const { settings, setSettings} = useSettings()
    const [webuiRunning, setWebuiRunning] = React.useState(false)
    const { t } = useTranslation()
    const [accessToken, setAccessToken] = React.useState('')
    const [isRemote, setIsRemote] = React.useState(true)
    React.useEffect(() => { setIsRemote(window.Greenlight?.isWebUI() !== false) }, [])
    async function revealToken() {
        if (!isRemote) setAccessToken(await Ipc.send('settings', 'getWebUIAccessToken') as string)
    }

    React.useEffect(() => {
        const webuiStatusInterval = setInterval(() => {
            Ipc.send('settings', 'getWebUIStatus').then((status) => {
                setWebuiRunning(status)
            })
        }, 1000)

        Ipc.send('settings', 'getWebUIStatus').then((status) => {
            setWebuiRunning(status)
        })

        return () => {
            clearInterval(webuiStatusInterval)
        }
    }, [])

    function setWebUIEnabled(){
        Ipc.send('settings', (webuiRunning) ? 'stopWebUI' : 'startWebUI').then((status) => {
            setWebuiRunning(status)
            setAccessToken('')
        })
    }

    function setWebUIAutostart(){
        setSettings({
            ...settings,
            webui_autostart: (! settings.webui_autostart),
        })
    }

    function setWebUIPort(e){
        setSettings({
            ...settings,
            webui_port: e.target.value,
        })
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.webUI.pageTitle')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <h1>{t('settings.webUI.title')}</h1>

                    <p>
                        <label>{t('settings.webUI.enableWebUILabel')}</label>
                        <label style={{ minWidth: 0 }}>
                            <Button onClick={ () => setWebUIEnabled() } disabled={isRemote} className={ ((webuiRunning) ? 'btn-cancel' : 'btn-primary') + ' btn-small' } label={ webuiRunning ? t('settings.webUI.stopWebUIBtn') : t('settings.webUI.startWebUIBtn') }></Button> &nbsp;
                            <Button onClick={ () => window.Greenlight.openExternal('http://127.0.0.1:'+settings.webui_port) } className={ 'btn-small' } label={ t('settings.webUI.openWebUIBtn') }></Button>
                        </label>
                    </p>

                    <p>
                        <label>{t('settings.webUI.autostartLabel')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type='checkbox' disabled={isRemote} onChange={ setWebUIAutostart } checked={settings.webui_autostart} />&nbsp; ({ settings.webui_autostart ? t('settings.webUI.autostartEnabled') : t('settings.webUI.autostartDisabled') })
                        </label>
                    </p>

                    <p>
                        <label>{t('settings.webUI.portLabel')}</label>
                        <label style={{ minWidth: 0 }}>
                            <input type="number" min={1024} max={65535} disabled={isRemote || webuiRunning} onChange={ setWebUIPort} className="text" placeholder={t('settings.webUI.portPlaceholder')} value={ settings.webui_port || 9003 } />
                        </label>
                    </p>
                </Card>
                {!isRemote && <Card className='padbottom'>
                    <h2>WebUI access</h2>
                    <p>Username: greenlight. The password changes whenever the server restarts. For remote access, use an SSH tunnel or a trusted HTTPS reverse proxy to the local WebUI port. Do not expose it over plain HTTP.</p>
                    <Button disabled={!webuiRunning} label={accessToken ? 'Hide password' : 'Reveal password'} onClick={() => { if (accessToken) setAccessToken(''); else void revealToken() }} />
                    {accessToken && <input className='text' readOnly aria-label='WebUI password' value={accessToken} onFocus={e => e.currentTarget.select()} />}
                </Card>}
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsWebUI
