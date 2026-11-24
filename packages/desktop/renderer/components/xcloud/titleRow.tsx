import React from 'react'
import GameTitleDynamic from '../ui/game/titledynamic'
import Loader from '../ui/loader'
import { useTranslation } from 'react-i18next'

interface Props {
    children: React.ReactNode;
    titles: unknown;
    loading?: boolean;
}

export default function TitleRow({ children, titles, loading = false }: Props) {
    const { t } = useTranslation()
    const ids: string[] = Array.isArray(titles) ? Array.from(new Set(titles.filter(id => typeof id === 'string'))) : []
    return <section className="gl-game-section">
        <h2 className="title">{children}</h2>
        {loading ? <Loader /> : ids.length === 0 ? <p className="gl-console-feedback">{t('page.xCloudLibrary.noGamesFound')}</p> :
            <div className="gl-game-row">{ids.slice(0, 24).map(id => <GameTitleDynamic key={id} titleId={id} />)}</div>}
    </section>
}
