import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import { useFriends, friendPresence } from '../../context/useFriends'
export default function FriendProfile() {
    const router = useRouter()
    const { t } = useTranslation()
    const friends = useFriends()
    const friend = friends.data?.find(item => item.xuid === router.query.xuid)
    return <section className="gl-profile-page">
        <Head><title>Greenlight - {friend?.displayName || t('dashboard.social')}</title></Head>
        <Link href="/social" className="btn">{t('dashboard.social')}</Link>
        {friend ? <><div className="gl-profile-hero"><div className="gl-avatar gl-avatar-large">{friend.displayPicRaw && <img src={friend.displayPicRaw} alt="" onError={e => { e.currentTarget.style.display = 'none' }} />}<i className="fa-solid fa-user" aria-hidden="true" /></div><div><p className="gl-eyebrow">{t('dashboard.xboxProfile')}</p><h1>{friend.displayName || friend.gamertag}</h1><p>{friendPresence(friend)}</p></div></div><div className="gl-profile-stats"><article><p>{t('auth.gamerscore')}</p><strong>{friend.gamerscore ?? '—'}</strong></article><article><p>{t('dashboard.platform')}</p><strong>Xbox</strong></article></div></> : <p>{friends.isLoading || !router.isReady ? t('dashboard.refreshing') : t('dashboard.profileUnavailable')}</p>}
    </section>
}
