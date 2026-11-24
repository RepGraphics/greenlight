import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useAchievementGames } from '../../context/useAchievements'
export default function Achievements() {
    const { t } = useTranslation()
    const query = useAchievementGames()
    const [search, setSearch] = React.useState('')
    const games = (query.data?.pages || []).flatMap(page => page.items)
    const visible = games.filter(game => String(game.name || '').toLowerCase().includes(search.trim().toLowerCase()))
    return <section className="gl-console-page">
        <Head><title>Greenlight - {t('dashboard.achievements')}</title></Head>
        <div className="gl-console-hero"><h1>{t('dashboard.achievements')}</h1><button className="btn" disabled={query.isFetching} onClick={() => { void query.refetch() }}>{t('dashboard.refresh')}</button></div>
        <input type="search" className="text" aria-label={t('dashboard.searchGames')} placeholder={t('dashboard.searchGames')} value={search} onChange={e => setSearch(e.target.value)} />
        {query.isLoading ? <p>{t('dashboard.refreshing')}</p> : query.isError && !games.length ? <p role="alert">{t('dashboard.requestFailed')}</p> : <div className="gl-achievement-list">{visible.map(game => {
            const max = Number(game.maxGamerscore) || 0
            const score = Number(game.currentGamerscore) || 0
            return <Link key={game.titleId} href={'/achievements/' + encodeURIComponent(String(game.titleId))} className="gl-achievement-card"><i className="fa-solid fa-trophy" aria-hidden="true" /><div><h2>{game.name}</h2><p>{game.earnedAchievements ?? '—'} {t('dashboard.unlocked')} · {score}/{max} G</p><progress max={max || 1} value={Math.max(0, Math.min(score, max))} /></div></Link>
        })}{!visible.length && <p>{t('page.xCloudLibrary.noGamesFound')}</p>}</div>}
        {query.hasNextPage && <button className="btn" disabled={query.isFetchingNextPage} onClick={() => { void query.fetchNextPage() }}>{t('dashboard.loadMore')}</button>}
    </section>
}
