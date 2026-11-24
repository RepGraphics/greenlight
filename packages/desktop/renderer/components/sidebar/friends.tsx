import React from 'react'
import Link from 'next/link'
import SidebarFriendItem from './frienditem'
import { useFriends } from '../../context/useFriends'
import { useTranslation } from 'react-i18next'

export default function SidebarFriends() {
    const { t } = useTranslation()
    const friends = useFriends()
    const online = (friends.data || []).filter(friend => friend.presenceState && friend.presenceState !== 'Offline')
    return <div id="components_sidebarfriends">
        <Link href="/social" className="gl-social-sidebar-heading">{t('dashboard.social')} · {online.length}</Link>
        {friends.isLoading ? <p>{t('dashboard.refreshing')}</p> : friends.isError ? <p>{t('dashboard.requestFailed')}</p> : online.length ? online.map(friend => <SidebarFriendItem key={friend.xuid} userinfo={friend} />) : <p>{t('friends.allFriendsOffline')}</p>}
    </div>
}
