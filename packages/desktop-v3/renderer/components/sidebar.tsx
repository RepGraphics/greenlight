import Link from 'next/link'
import {useRouter} from 'next/router'
import {useAuth} from '../contexts/AuthContext'
import Brand from './brand'

const pages = [
    {path: '/home', label: 'Cloud Gaming'},
    {path: '/consoles', label: 'My Consoles'},
]

export default function Sidebar() {
    const {pathname} = useRouter()
    const {authState, logout} = useAuth()
    const profile = authState?.webToken?.data.DisplayClaims?.xui?.[0]
    const name = profile && typeof profile === 'object' && 'gtg' in profile ? profile.gtg : undefined
    const signOut = () => {
        if (window.confirm('Sign out of Greenlight?')) logout()
    }

    return <aside className="v3-sidebar">
        <Brand/>
        <nav aria-label="Greenlight">
            {pages.map(({path, label}) => <Link key={path} href={path + '/'} aria-current={pathname === path ? 'page' : undefined}>{label}</Link>)}
        </nav>
        <div className="v3-sidebar-account">
            {typeof name === 'string' && name && <p title={name}>{name}</p>}
            <button className="v3-button v3-button-secondary" type="button" onClick={signOut}>Sign out</button>
        </div>
    </aside>
}
