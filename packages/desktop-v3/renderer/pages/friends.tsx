import {useEffect, useRef, useState} from 'react'
import Head from 'next/head'
import {RefreshCw, Search, UserRound, Users} from 'lucide-react'
import DashboardLayout from '../components/dashboardlayout'
import {useAuth} from '../contexts/AuthContext'
import {AuthAttempt} from '../contexts/authattempt'
import {useTRPCClient} from '../utils/trpc'
import {xboxImage} from '../utils/xboxart'

type Person = {id: string; name: string; image?: string; status?: string; online?: boolean}

function Avatar({name, image}: Person) {
    return <span className="v3-avatar" aria-hidden="true">
        {name[0] ?? <UserRound size={20}/>}
        {image && <img src={image} key={image} alt="" referrerPolicy="no-referrer" onError={event => {event.currentTarget.hidden = true}}/>}
    </span>
}

export default function FriendsPage() {
    const client = useTRPCClient()
    const {getWebToken} = useAuth()
    const {uhs, token} = getWebToken()
    const attempts = useRef(new AuthAttempt())
    const [profile, setProfile] = useState<Person>()
    const [friends, setFriends] = useState<Person[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [failed, setFailed] = useState(false)

    async function load() {
        if (!token || !uhs) {
            setLoading(false)
            return
        }
        const attempt = attempts.current.begin()
        setLoading(true)
        setFailed(false)
        const credentials = {uhs, token}
        const options = {signal: attempt.signal}
        await Promise.all([
            client.profile_get_current.query(credentials, options).then(response => {
                if (!attempt.current()) return
                const entry = response.data?.profileUsers?.[0]
                const settings = entry?.settings
                const value = (id: string) => settings?.find(setting => setting.id === id)?.value
                const name = value('Gamertag') || value('GameDisplayName')
                const score = value('Gamerscore')
                setProfile(entry && name ? {id: entry.id, name, image: xboxImage(value('GameDisplayPicRaw')), status: score ? score+' gamerscore' : undefined} : undefined)
            }).catch(() => {if (attempt.current()) setProfile(undefined)}),
            client.profile_get_friends.query(credentials, options).then(response => {
                if (!attempt.current()) return
                if (!Array.isArray(response.data?.people)) throw Error('Friends list unavailable')
                setFriends(response.data.people.filter(friend => friend?.xuid && friend.gamertag).map(friend => ({
                    id: friend.xuid, name: friend.gamertag, image: xboxImage(friend.displayPicRaw),
                    status: friend.presenceText, online: friend.presenceState === 'Online',
                })).sort((a, b) => Number(b.online)-Number(a.online) || a.name.localeCompare(b.name)))
            }).catch(() => {
                if (attempt.current()) setFailed(true)
            }).finally(() => {if (attempt.current()) setLoading(false)}),
        ])
    }

    useEffect(() => {
        setFriends([])
        setProfile(undefined)
        void load()
        return () => {attempts.current.cancel()}
    }, [client, uhs, token])

    const visible = friends.filter(person => person.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    return <DashboardLayout>
        <Head><title>Greenlight V3 — Friends</title></Head>
        <header className="v3-page-header">
            <div><h1>Friends</h1><p>See who’s online on Xbox.</p></div>
            <button className="v3-button v3-button-secondary" type="button" disabled={loading || !uhs || !token} onClick={() => void load()}><RefreshCw size={16} aria-hidden="true"/> Refresh</button>
        </header>
        {profile && <section className="v3-panel v3-profile v3-section-spacing" aria-label="Your Xbox profile">
            <Avatar {...profile}/><div><h2>{profile.name}</h2>{profile.status && <p>{profile.status}</p>}</div>
        </section>}
        <div className="v3-filters v3-section-spacing">
            <label className="v3-search"><Search size={17} aria-hidden="true"/><input className="v3-field" type="search" maxLength={100} placeholder="Search friends" aria-label="Search friends" value={search} onChange={event=>setSearch(event.target.value)}/></label>
        </div>
        {loading && <p role="status">Loading Xbox friends…</p>}
        {(!token || !uhs || failed) && <p className="v3-notice v3-section-spacing" role="alert">Couldn’t load Xbox friends. {token && uhs ? 'Refresh to try again.' : 'Sign in again.'}</p>}
        {!loading && !failed && token && uhs && visible.length === 0 && <section className="v3-panel v3-empty v3-section-spacing"><Users size={30} aria-hidden="true"/><h2>{search.trim() ? 'No matching friends' : 'No friends to show'}</h2></section>}
        {visible.length > 0 && <ul className="v3-panel v3-people v3-section-spacing" aria-label="Xbox friends">
            {visible.map(person => <li key={person.id}>
                <Avatar {...person}/>
                <div><strong>{person.name}</strong><p>{person.status || (person.online ? 'Online' : 'Offline')}</p></div>
                {person.online && <span className="v3-console-ready">Online</span>}
            </li>)}
        </ul>}
    </DashboardLayout>
}
