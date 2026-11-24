import React from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import { useGameAchievements } from '../../context/useAchievements'
export default function AchievementTitle() {
    const { t } = useTranslation()
    const router = useRouter()
    const id = typeof router.query.titleid === 'string' ? router.query.titleid : ''
    const query = useGameAchievements(id)
    const [filter, setFilter] = React.useState('all')
    const items = (query.data?.pages || []).flatMap(page => page.items)
    const unlocked = items.filter(item => item.progressState === 'Achieved').length
    const visible = items.filter(item => filter === 'all' || (item.progressState === 'Achieved') === (filter === 'unlocked'))
    return <section className="gl-console-page">
        <Head><title>Greenlight - {t('dashboard.achievements')}</title></Head>
        <Link href="/achievements" className="btn">{t('dashboard.achievements')}</Link>
        <h1>{items[0]?.titleAssociations?.[0]?.name || t('dashboard.achievements')}</h1>
        <p>{unlocked} / {items.length} {t('dashboard.unlocked')} ({t('dashboard.loadedItems')})</p>
        <div className="gl-console-toolbar">{['all','unlocked','locked'].map(value => <button key={value} className={'btn ' + (value === filter ? 'btn-primary' : '')} aria-pressed={value === filter} onClick={() => setFilter(value)}>{t('dashboard.' + value)}</button>)}</div>
        {!router.isReady || query.isLoading ? <p>{t('dashboard.refreshing')}</p> : query.isError && !items.length ? <p role="alert">{t('dashboard.requestFailed')}</p> : <div className="gl-achievement-list">{visible.map(item => {
            const achieved = item.progressState === 'Achieved'
            const secret = item.isSecret && !achieved
            const reward = item.rewards?.find(reward => reward.type === 'Gamerscore')?.value
            return <article key={(item.serviceConfigId || '') + ':' + item.id} className="gl-achievement-card"><i className={'fa-solid ' + (achieved ? 'fa-trophy' : 'fa-lock')} aria-hidden="true" /><div><h2>{secret ? t('dashboard.secretAchievement') : item.name}</h2><p>{secret ? t('dashboard.secretDescription') : achieved ? item.description : item.lockedDescription}</p><p>{t(achieved ? 'dashboard.unlocked' : 'dashboard.locked')}{reward && !secret ? ' · ' + reward + ' G' : ''}</p></div></article>
        })}{!visible.length && <p>{t('dashboard.noAchievements')}</p>}</div>}
        {query.hasNextPage && <button className="btn" disabled={query.isFetchingNextPage} onClick={() => { void query.fetchNextPage() }}>{t('dashboard.loadMore')}</button>}
    </section>
}
