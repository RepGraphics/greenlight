import React from 'react'
import Head from 'next/head'
import { useTranslation } from 'react-i18next'
import { useFriends } from '../context/useFriends'
import SidebarFriendItem from '../components/sidebar/frienditem'
export default function Social() {
    const { t } = useTranslation()
    const friends = useFriends()
    const [search, setSearch] = React.useState('')
    const [onlineOnly, setOnlineOnly] = React.useState(false)
    const all = friends.data || []
    const online = (friend) => Boolean(friend.presenceState && friend.presenceState !== 'Offline')
    const visible = all.filter(friend => (!onlineOnly || online(friend)) && (friend.displayName || friend.gamertag || '').toLowerCase().includes(search.trim().toLowerCase())).sort((a,b) => Number(online(b)) - Number(online(a)))
    return <section className="gl-console-page">
        <Head><title>Greenlight - {t('dashboard.social')}</title></Head>
        <div className="gl-console-hero"><h1>{t('dashboard.social')}</h1><button className="btn" disabled={friends.isFetching} onClick={() => { void friends.refetch() }}>{t('dashboard.refresh')}</button></div>
        <p>{t('dashboard.friendsOnline', { count: all.filter(online).length })} · {t('dashboard.totalFriends', { count: all.length })}</p>
        <div className="gl-console-toolbar"><input className="text" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('dashboard.searchFriends')} aria-label={t('dashboard.searchFriends')} /><button type="button" className={'btn ' + (onlineOnly ? 'btn-primary' : '')} aria-pressed={onlineOnly} onClick={() => setOnlineOnly(!onlineOnly)}>{t('dashboard.onlineOnly')}</button></div>
        {friends.isLoading ? <p>{t('dashboard.refreshing')}</p> : friends.isError ? <p role="alert">{t('dashboard.requestFailed')}</p> : visible.length ? <div className="gl-social-grid">{visible.map(friend => <SidebarFriendItem key={friend.xuid} userinfo={friend} />)}</div> : <p>{t('dashboard.noFriendsFound')}</p>}
    </section>
}
