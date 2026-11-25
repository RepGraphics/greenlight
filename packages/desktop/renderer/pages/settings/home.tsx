import React from 'react'
import SettingsBackup from '../../components/settings/settingsbackup'
import AppearanceSettings from '../../components/settings/appearancesettings'
import UpdateChecker from '../../components/settings/updatechecker'
import { useTranslation } from 'react-i18next'
import LanguageSelector from '../../components/settings/LanguageSelector'
import Head from 'next/head'
import Link from 'next/link'
import Ipc from '../../lib/ipc'

import SettingsSidebar from '../../components/settings/sidebar'
import Image from 'next/image'
import GreenlightLogo from '../../public/images/logo.png'
import Card from '../../components/ui/card'
import Button from '../../components/ui/button'

interface userData {
  gamerpic?: string;
  gamerscore?: string;
  gamertag?: string;
  level?: number;
  signedIn?: boolean;
  type?: string;
}

function SettingsHome() {
    const [user, setUser] = React.useState<userData>({})
    const { t } = useTranslation()

    React.useEffect(() => {
        if(Object.keys(user).length === 0){
            Ipc.send('app', 'loadCachedUser').then((user) => {
                console.log('Set user:', user)
                setUser(user)
            })
        }
    }, [user])

    function logout(){
        if(confirm(t('settings.about.logoutQuestion'))){
            Ipc.send('app', 'clearData')
        }
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('settings.about.title')}</title>
            </Head>

            <SettingsSidebar>
                <Card>
                    <div id="component_auth_modal">
                        <div className="component_auth_profile_gamerpic" style={{
                            float: 'left',
                            marginTop: 20,
                            marginLeft: 20,
                            marginRight: 40,
                        }}>
                            {user.gamerpic ? <Image src={ user.gamerpic } alt={ user.gamertag || 'Xbox profile' } width='100' height='100' className="component_auth_profile_gamerpic_img" /> : <i className='fa-solid fa-user' aria-hidden='true' />}
                        </div>

                        <div className="component_auth_profile_userdetails">
                            <h1 style={{ paddingBottom: 5 }}>{ user.gamertag }</h1>
                            <p>
                                {t('settings.about.gamerscore')}: { user.gamerscore }
                            </p>
                            <Button label={t('settings.about.logout')} className='btn' disabled={(typeof window !== 'undefined' && window.Greenlight?.isWebUI() === false) ? false : true } onClick={ () => {
                                logout()
                            } }></Button>
                        </div>

                        <br style={{ clear: 'both' }} />
                    </div>
                </Card>

                <LanguageSelector />
                <AppearanceSettings />
                <SettingsBackup />
                <UpdateChecker />

                <Card>
                    <div style={{ textAlign: 'center' }}>
                        <Image src={ GreenlightLogo } width="100" height="100" alt="Greenlight" />

                        <h2>Greenlight</h2>
                        <p>
                            {t('settings.about.version')}: { typeof window !== 'undefined' ? window.Greenlight?.getVersion() : '' }<br /><br />
                            <small>{t('settings.about.website')}: <Link href="#" title={t('settings.about.websiteLinkTitle')} onClick={ () => {
                                window.Greenlight.openExternal('https://github.com/RepGraphics/greenlight')
                            }}>github.com/RepGraphics/greenlight</Link></small><br />
                            <small>{t('authorOfLocalization')}</small>
                        </p>
                    </div>
                </Card>
            </SettingsSidebar>


        </React.Fragment>
    )
}

export default SettingsHome
