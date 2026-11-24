import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

interface ProfileProps {
    account?: { gamertag?: string; gamerpic?: string; gamerscore?: string; signedIn?: boolean }
}

export default function Profile({ account }: ProfileProps) {
    const { t } = useTranslation()
    const [imageFailed, setImageFailed] = React.useState(false)
    React.useEffect(() => { setImageFailed(false) }, [account?.gamerpic])
    return (
        <section className="gl-profile-page">
            <Head><title>Greenlight - My Profile</title></Head>
            <h1>My profile</h1>
            {!account?.gamertag ? <p className="gl-console-feedback" role="status">Profile information is not available yet.</p> : (
                <>
                    <div className="gl-profile-hero">
                        <div className="gl-avatar gl-avatar-large">
                            {account.gamerpic && !imageFailed ? <img src={account.gamerpic} alt="" onError={() => setImageFailed(true)} /> : null}
                            <i className="fa-solid fa-user" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="gl-eyebrow">Xbox profile</p>
                            <h2>{account.gamertag}</h2>
                            <p className="gl-profile-status"><span />{account.signedIn ? 'Signed in' : 'Account'}</p>
                        </div>
                    </div>
                    <div className="gl-profile-stats">
                        <article><i className="fa-solid fa-trophy" aria-hidden="true" /><p>{t('auth.gamerscore')}</p><strong>{account.gamerscore === '' || account.gamerscore == null ? '—' : account.gamerscore}</strong></article>
                        <article><i className="fa-brands fa-xbox" aria-hidden="true" /><p>Platform</p><strong>Xbox</strong></article>
                    </div>
                    <h2 className="gl-section-heading">Quick access</h2>
                    <div className="gl-profile-links">
                        <Link href="/home"><i className="fa-solid fa-gamepad" aria-hidden="true" />{t('header.myConsoles')}</Link>
                        <Link href="/settings/home"><i className="fa-solid fa-gear" aria-hidden="true" />{t('header.settings')}</Link>
                    </div>
                </>
            )}
        </section>
    )
}
