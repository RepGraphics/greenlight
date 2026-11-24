import React from 'react'
import Link from 'next/link'
import { XboxFriend, friendPresence } from '../../context/useFriends'
export default function SidebarFriendItem({ userinfo }: { userinfo: XboxFriend }) {
    return <Link className="components_sidebarfrienditem gl-friend-link" href={'/profile/' + encodeURIComponent(userinfo.xuid)}>
        <span className="gl-avatar gl-avatar-small">
            {userinfo.displayPicRaw && <img src={userinfo.displayPicRaw} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none' }} />}
            <i className="fa-solid fa-user" aria-hidden="true" />
        </span>
        <span className="gl-friend-details"><strong>{userinfo.displayName || userinfo.gamertag || userinfo.xuid}</strong><span>{friendPresence(userinfo)}</span></span>
    </Link>
}
