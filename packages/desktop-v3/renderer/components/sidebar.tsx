import Link from 'next/link'
import {Cloud, Gamepad2, LogOut, Settings2, Users} from 'lucide-react'
import {useRouter} from 'next/router'
import {useAuth} from '../contexts/AuthContext'
import Brand from './brand'

const pages = [
    {path: '/home', label: 'Cloud Gaming', Icon: Cloud},
    {path: '/consoles', label: 'My Consoles', Icon: Gamepad2},
    {path: '/friends', label: 'Friends', Icon: Users},
    {path: '/settings', label: 'Settings', Icon: Settings2},
]

export default function Sidebar() {
    const {pathname} = useRouter()
    const {authState, logout} = useAuth()
    const profile = authState?.webToken?.data.DisplayClaims?.xui?.[0]
    const name = profile && typeof profile === 'object' && 'gtg' in profile ? profile.gtg : undefined
    const accountName = typeof name === 'string' && name.trim() ? name.trim() : 'Xbox account'
    const signOut = () => {
        if (window.confirm('Sign out of Greenlight?')) logout()
    }

    return <aside className="v3-sidebar">
        <Brand showVersion={false}/>
        <nav aria-label="Greenlight">
            {pages.map(({path, label, Icon}) => <Link key={path} href={path + '/'} aria-current={pathname === path ? 'page' : undefined}><Icon size={19} aria-hidden="true"/>{label}</Link>)}
        </nav>
        <div className="v3-sidebar-account">
            <span className="v3-account-icon" aria-hidden="true">{accountName[0]?.toUpperCase()}</span>
            <p title={accountName}>{accountName}</p>
            <button className="v3-button v3-sign-out" aria-label="Sign out" title="Sign out" type="button" onClick={signOut}><LogOut size={17} aria-hidden="true"/></button>
        </div>
    </aside>
}
