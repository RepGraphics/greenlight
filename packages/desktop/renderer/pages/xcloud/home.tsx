import React from 'react'
import { useGameFavourites } from '../../context/gameFavourites'
import Head from 'next/head'
import Link from 'next/link'
import Ipc from '../../lib/ipc'
import BreadcrumbBar from '../../components/ui/breadcrumbbar'
import TitleRow from '../../components/xcloud/titleRow'
import { useQuery } from 'react-query'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../../context/userContext'

function xCloudHome() {
    const { t } = useTranslation()
    const { favourites } = useGameFavourites()
    const { settings } = useSettings()
    useQuery(['xCloudTitles', settings.xcloud_show_non_entitled], () => Ipc.send('xCloud', 'getTitles', { showNonEntitled: settings.xcloud_show_non_entitled }), { staleTime: 300*1000 })
    const xCloudNewTitles = useQuery(['xCloudNewTitles', settings.xcloud_show_non_entitled], () => Ipc.send('xCloud', 'getNewTitles', { showNonEntitled: settings.xcloud_show_non_entitled }), { staleTime: 60*1000 })
    const xCloudRecentTitles = useQuery('xCloudRecentTitles', () => Ipc.send('xCloud', 'getRecentTitles'), { staleTime: 10*1000 })

    return (
        <React.Fragment>
            <Head>
                <title>Greenlight - {t('page.xCloud.pageTitle')}</title>
            </Head>

            <BreadcrumbBar>
                <Link href="/xcloud/home">{t('page.xCloud.breadcrumb')}</Link>
                {/* <Link href="/xcloud/library">Library</Link> */}
            </BreadcrumbBar>

            {favourites.length > 0 && <TitleRow titles={favourites}>{t('dashboard.gameFavourites')}</TitleRow>}
            <TitleRow loading={xCloudRecentTitles.isLoading} titles={xCloudRecentTitles.data}>{t('page.xCloud.recentGames')}</TitleRow>

            <TitleRow loading={xCloudNewTitles.isLoading} titles={xCloudNewTitles.data}>
                {t('page.xCloud.recentlyAdded')}&nbsp;
                <Link href="/xcloud/library" className='btn btn-small'>{t('page.xCloud.viewLibraryBtn')}</Link>
            </TitleRow>

            {/* } */}

        </React.Fragment>
    )
}

export default xCloudHome
