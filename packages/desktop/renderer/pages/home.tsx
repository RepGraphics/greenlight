import React from 'react'
import TitleRow from '../components/xcloud/titleRow'
import { useGameFavourites } from '../context/gameFavourites'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import Ipc from '../lib/ipc'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'

import Button from '../components/ui/button'
import Card from '../components/ui/card'
import Label from '../components/ui/label'
import Loader from '../components/ui/loader'

function Home({ account }: { account?: { gamertag?: string; level?: string | number } }) {
    const consoles = useQuery('consoles', () => Ipc.send('consoles', 'get'), { staleTime: 60*1000 })
    const { t } = useTranslation()
    const { favourites: gameFavourites } = useGameFavourites()
    const hasCloud = Number(account?.level) > 1
    const recentGames = useQuery('xCloudRecentTitles', () => Ipc.send('xCloud', 'getRecentTitles'), { enabled: hasCloud, staleTime: 60000 })
    const [favourites, setFavourites] = React.useState<string[]>([])
    const [lastConsole, setLastConsole] = React.useState<string | null>(null)
    const [search, setSearch] = React.useState('')
    const [onlyFavourites, setOnlyFavourites] = React.useState(false)
    const storageKey = 'greenlight.dashboard.' + (account?.gamertag || 'local')
    React.useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '{}')
            setFavourites(Array.isArray(saved.favourites) ? saved.favourites.filter((id: unknown) => typeof id === 'string') : [])
            setLastConsole(typeof saved.lastConsole === 'string' ? saved.lastConsole : null)
        } catch { setFavourites([]); setLastConsole(null) }
    }, [storageKey])
    function save(next: string[], recent: string | null) {
        setFavourites(next)
        setLastConsole(recent)
        try { localStorage.setItem(storageKey, JSON.stringify({ favourites: next, lastConsole: recent })) } catch { /* Storage may be unavailable. */ }
    }
    const all = Array.isArray(consoles.data) ? consoles.data : []
    const visible = all.filter(item => (!onlyFavourites || favourites.includes(item.id)) && String(item.name || '').toLowerCase().includes(search.trim().toLowerCase())).sort((a,b) => Number(favourites.includes(b.id)) - Number(favourites.includes(a.id)))
    const recent = all.find(item => item.id === lastConsole)
    const ready = (item) => item.remoteManagementEnabled === true && item.consoleStreamingEnabled === true

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('page.myConsoles.pageTitle')}</title>
            </Head>

            <section className='gl-console-page'>
                <div className='gl-dashboard-welcome'><p className='gl-eyebrow'>Xbox</p><h1>{t('dashboard.welcome', { name: account?.gamertag || '' })}</h1><div className='gl-dashboard-links'>{hasCloud && <Link href='/xcloud/library' className='btn btn-primary'><i className='fa-solid fa-cloud' aria-hidden='true' /> {t('header.xCloudLibrary')}</Link>}<Link href='/profile' className='btn'>{t('dashboard.profile')}</Link><Link href='/settings/streaming' className='btn'>{t('dashboard.qualityPresets')}</Link></div></div>
                <div className='gl-console-hero'>
                    <h1>{t('page.myConsoles.pageTitle')}</h1>
                    <Button label={consoles.isFetching ? t('dashboard.refreshing') : t('dashboard.refresh')} disabled={consoles.isFetching} onClick={() => { void consoles.refetch() }} />
                </div>
                {recent && ready(recent) && <div className='gl-resume-card'>
                    <div><span className='gl-eyebrow'>{t('dashboard.lastConsole')}</span><h2>{recent.name}</h2><p>{t('dashboard.resumeDescription')}</p></div>
                    <Link className='btn btn-primary' href={`/stream/${encodeURIComponent(recent.id)}`}><i className='fa-solid fa-play' aria-hidden='true' /> {t('dashboard.connectAgain')}</Link>
                </div>}
                <div className='gl-console-toolbar'>
                    <input className='text' type='search' value={search} onChange={e => setSearch(e.target.value)} placeholder={t('dashboard.searchConsoles')} aria-label={t('dashboard.searchConsoles')} />
                    <button type='button' className={'btn ' + (onlyFavourites ? 'btn-primary' : '')} aria-pressed={onlyFavourites} onClick={() => setOnlyFavourites(!onlyFavourites)}><i className='fa-solid fa-star' aria-hidden='true' /> {t('dashboard.favourites')}</button>
                    <span className='gl-console-count'>{t('dashboard.consoleCount', { count: visible.length })}</span>
                </div>
                <div className='gl-console-grid' aria-busy={consoles.isFetching}>
                { (consoles.isLoading === true) ? <Loader></Loader> :
                    consoles.isError && !Array.isArray(consoles.data) ? <div className='gl-console-feedback' role='alert'>{t('dashboard.consoleError')}</div> :
                    visible.length > 0 ? visible.map((item) => {
                        return (
                            <Card className='padbottom' key={item.id}>
                                <div className='gl-console-card-heading'><h1>{item.name}</h1><button type='button' className='gl-favourite' aria-pressed={favourites.includes(item.id)} title={t(favourites.includes(item.id) ? 'dashboard.removeFavourite' : 'dashboard.addFavourite')} aria-label={t(favourites.includes(item.id) ? 'dashboard.removeFavourite' : 'dashboard.addFavourite')} onClick={() => save(favourites.includes(item.id) ? favourites.filter(id => id !== item.id) : [...favourites, item.id], lastConsole)}><i className={(favourites.includes(item.id) ? 'fa-solid' : 'fa-regular') + ' fa-star'} aria-hidden='true' /></button></div>

                                <div style={{
                                    width: 200,
                                    margin: '0 auto',
                                    paddingTop: 10,
                                }}>
                                    <Image src="data:image/png;base64,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" style={{
                                        width: 200,
                                        textAlign: 'center',
                                    }} alt='Console' width={ 200 } height={ 56 }></Image>
                                </div>

                                <h2 className='grey' style={{
                                    textAlign: 'center',
                                    fontSize: 12,
                                }}>{item.id}</h2>

                                <br />

                                {(item.remoteManagementEnabled === true && item.consoleStreamingEnabled === true) ?
                                    (item.powerState === 'On' ? <Label className='green'>{t('page.myConsoles.poweredOn')}</Label> :
                                        item.powerState === 'ConnectedStandby' ? <Label>{t('page.myConsoles.standby')}</Label> :
                                            <Label>{item.powerState}</Label>) :
                                    (<div>
                                        {item.remoteManagementEnabled ? '' : <p><Label className='orange'>{t('page.myConsoles.warningLabel')}</Label> {t('page.myConsoles.managementWarning')}</p>}
                                        {item.consoleStreamingEnabled ? '' : <p><Label className='orange'>{t('page.myConsoles.warningLabel')}</Label> {t('page.myConsoles.streamingWarning')}</p>}
                                    </div>)}

                                {/* <p>Name: {item.name}</p>
                                <p>ID: {item.id}</p>
                                <p>State: {item.powerState}</p>
                                <p>Type: {item.consoleType}</p>
                                <p>Assistant: {item.digitalAssistantRemoteControlEnabled ? 'Enabled' : 'Disabled'}</p>
                                <p>Remote: {item.remoteManagementEnabled ? 'Enabled' : 'Disabled'}</p>
                                <p>Streaming: {item.consoleStreamingEnabled ? 'Enabled' : 'Disabled'}</p><br /> */}

                                <div className='gl-console-actions'>
                                    <Link href={ `/stream/${encodeURIComponent(item.id)}` } onClick={() => save(favourites, item.id)}>
                                        <span className='btn btn-primary'>{t('page.myConsoles.startStreamBtn')}</span>
                                    </Link>
                                </div>
                            </Card>
                        )
                    }) : <div className='gl-console-feedback'>{all.length ? t('dashboard.noMatchingConsoles') : t('page.myConsoles.noConsoles')}</div>
                }
                </div>
                {hasCloud && <><div className='gl-dashboard-cloud'><h2>{t('header.xCloudLibrary')}</h2><Link href='/xcloud/library' className='btn'>{t('page.xCloud.viewLibraryBtn')}</Link></div>{gameFavourites.length > 0 && <TitleRow titles={gameFavourites}>{t('dashboard.gameFavourites')}</TitleRow>}<TitleRow loading={recentGames.isLoading} titles={recentGames.data}>{t('page.xCloud.recentGames')}</TitleRow></>}
            </section>

        </React.Fragment>
    )
}

export default Home
