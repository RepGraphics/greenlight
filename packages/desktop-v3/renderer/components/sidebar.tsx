import Link from 'next/link'
import {ArrowLeftRight, Cloud, Gamepad2, LogOut, Settings2, Users} from 'lucide-react'
import {useRouter} from 'next/router'
import {useAuth} from '../contexts/AuthContext'
import Brand from './brand'
import {AccountAvatar} from './accountpicker'

const pages = [
    {path: '/home', label: 'Cloud Gaming', Icon: Cloud},
    {path: '/consoles', label: 'My Consoles', Icon: Gamepad2},
    {path: '/friends', label: 'Friends', Icon: Users},
    {path: '/settings', label: 'Settings', Icon: Settings2},
]

export default function Sidebar() {
    const router = useRouter()
    const {pathname} = router
    const {authState, logout, desktop, savedAccounts, activeAccount, accountSaved} = useAuth()
    const profile = authState?.webToken?.data.DisplayClaims?.xui?.[0]
    const name = profile && typeof profile === 'object' && 'gtg' in profile ? profile.gtg : undefined
    const accountName = activeAccount?.name || (typeof name === 'string' && name.trim() ? name.trim() : 'Xbox account')
    const canSwitch = desktop && savedAccounts.length > 0
    const actionLabel = canSwitch ? 'Switch account' : 'Sign out'
    const signOut = () => {
        if (canSwitch || window.confirm('Sign out of Greenlight?')) {
            logout()
            if (canSwitch && pathname !== '/home') void router.replace('/home/')
        }
    }

    return <aside className="v3-sidebar">
        <Brand showVersion={false}/>
        <nav aria-label="Greenlight">
            {pages.map(({path, label, Icon}) => <Link key={path} href={path + '/'} aria-current={pathname === path ? 'page' : undefined}><Icon size={19} aria-hidden="true"/>{label}</Link>)}
        </nav>
        <div className="v3-sidebar-account">
            <AccountAvatar account={activeAccount} name={accountName}/>
            <div className="v3-account-label"><p title={accountName}>{accountName}</p>
                {desktop && !accountSaved && <small>Session only</small>}
            </div>
            <button className="v3-button v3-sign-out" aria-label={actionLabel} title={actionLabel} type="button" onClick={signOut}>
                {canSwitch ? <ArrowLeftRight size={17} aria-hidden="true"/> : <LogOut size={17} aria-hidden="true"/>}
            </button>
        </div>
    </aside>
}
