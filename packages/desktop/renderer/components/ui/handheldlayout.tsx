import React from 'react'
import { useSettings } from '../../context/userContext'
import { useTranslation } from 'react-i18next'
export default function HandheldLayout({ children, streaming }: { children: React.ReactNode; streaming: boolean }) {
    const { settings } = useSettings()
    const { t } = useTranslation()
    const [compact, setCompact] = React.useState(false)
    React.useEffect(() => {
        const media = window.matchMedia('(max-width: 1100px) and (max-height: 850px)')
        const update = () => setCompact(media.matches)
        update()
        media.addEventListener('change', update)
        return () => media.removeEventListener('change', update)
    }, [])
    const enabled = !streaming && (settings.handheld_mode === 'on' || (settings.handheld_mode !== 'off' && compact))
    return <div className={enabled ? 'gl-handheld' : ''}>
        {children}
        {enabled && <div className="gl-handheld-hints" aria-hidden="true"><span>Ⓐ {t('dashboard.selectHint')}</span><span>Ⓑ {t('dashboard.backHint')}</span><span>↔ {t('dashboard.navigateHint')}</span></div>}
    </div>
}
