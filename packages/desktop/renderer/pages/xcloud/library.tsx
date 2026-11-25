import React from 'react'
import { useGameFavourites } from '../../context/gameFavourites'
import Head from 'next/head'
import Ipc from '../../lib/ipc'
import Link from 'next/link'
import Loader from '../../components/ui/loader'
import ViewportGrid from '../../components/ui/viewportgrid'
import GameTitleDynamic from '../../components/ui/game/titledynamic'
import BreadcrumbBar from '../../components/ui/breadcrumbbar'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'


function xCloudLibrary() {
    const { t } = useTranslation()
    const { favourites } = useGameFavourites()
    const [favouritesOnly, setFavouritesOnly] = React.useState(false)
    const [searchTerm, setSearchTerm] = React.useState('')
    const [debouncedSearch, setDebouncedSearch] = React.useState('')
    const [gamePassOnly, setGamePassOnly] = React.useState(true)
    const [sort,setSort]=React.useState<'default'|'az'|'za'>('default')

    // Debounce search input by 250ms to prevent query churn
    React.useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm)
        }, 250)
        return () => {
            clearTimeout(handler)
        }
    }, [searchTerm])

    const trimmedSearch = debouncedSearch.trim()
    const titlesQuery = useQuery(
        ['xCloudTitles', trimmedSearch, gamePassOnly,sort],
        () => Ipc.send('xCloud', 'filterTitles', { name: trimmedSearch, onlyEntitled: gamePassOnly,sort }),
        { staleTime: 60 * 1000, keepPreviousData: true }
    )

    const titles: string[] = Array.from(new Set<string>((Array.isArray(titlesQuery.data) ? titlesQuery.data : []).filter(id => typeof id==='string'&&(!favouritesOnly || favourites.includes(id)))))

    const renderContent = () => {
        if (titlesQuery.isLoading && !titlesQuery.data) {
            return <Loader />
        }

        if (titlesQuery.isError && !titlesQuery.data) return <div className='gl-console-feedback' role='alert'>{t('dashboard.requestFailed')} <button className='btn' onClick={() => { void titlesQuery.refetch() }}>{t('dashboard.refresh')}</button></div>

        if (titles.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888888', fontSize: '16px' }}>
                    {t('page.xCloudLibrary.noGamesFound')}
                </div>
            )
        }

        return (
            <ViewportGrid key={`library_${trimmedSearch}_${gamePassOnly}_${favouritesOnly}_${sort}`} drawPagination={true}>
                { titles.map((item) => (
                    <GameTitleDynamic
                        titleId={ item }
                        key={ item }
                    />
                )) }
            </ViewportGrid>
        )
    }

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('page.xCloudLibrary.pageTitle')}</title>
            </Head>

            <BreadcrumbBar>
                <Link href="/xcloud/home">{t('page.xCloudLibrary.breadcrumb1')}</Link>
                <Link href="/xcloud/library">{t('page.xCloudLibrary.breadcrumb2')}</Link>
            </BreadcrumbBar>

            <div className="gl-library-heading"><h2>
                {t('page.xCloudLibrary.title')}</h2>

                <div className="gl-library-filters">
                    <button type='button' className={'btn ' + (favouritesOnly ? 'btn-primary' : '')} aria-pressed={favouritesOnly} onClick={() => setFavouritesOnly(!favouritesOnly)}><i className='fa-solid fa-star' aria-hidden='true' /> {t('dashboard.favourites')}</button>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', userSelect: 'none', fontWeight: 300, minWidth: 0, paddingRight: '4px' }}>
                        <input
                            type="checkbox"
                            checked={gamePassOnly}
                            onChange={(e) => setGamePassOnly(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                        />
                        <span>{t('page.xCloudLibrary.gamePassOnly')}</span>
                    </label>

                    <label htmlFor='cloud-library-sort' style={{minWidth:0}}>{t('dashboard.librarySort')}</label><select id='cloud-library-sort' value={sort} onChange={event=>setSort(event.target.value as typeof sort)}>
                        {(['default','az','za'] as const).map(value=><option key={value} value={value}>{t('dashboard.librarySort_'+value)}</option>)}
                    </select>
                    <input
                        type="search"
                        maxLength={100}
                        className="text h2-search"
                        style={{ float: 'none', margin: 0 }}
                        aria-label={t('page.xCloudLibrary.searchPlaceholder')}
                        placeholder={t('page.xCloudLibrary.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <p role='status' aria-live='polite'>{titlesQuery.isFetching?t('dashboard.refreshing'):t('dashboard.libraryResultCount',{count:titles.length})}</p>
            <div aria-busy={titlesQuery.isFetching}>{ renderContent() }</div>

        </React.Fragment>
    )
}

export default xCloudLibrary

