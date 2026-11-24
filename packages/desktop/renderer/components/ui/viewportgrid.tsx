import React from 'react'
import Button from './button'
import { useTranslation } from 'react-i18next'
interface ViewportGridProps { drawPagination?: boolean; maxHeight?: number; children: React.ReactNode }
export default function ViewportGrid({ drawPagination = false, maxHeight = -1, children }: ViewportGridProps) {
    const { t } = useTranslation()
    const [page, setPage] = React.useState(0)
    const items = React.Children.toArray(children)
    const pageSize = 24
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
    const current = Math.min(page, totalPages - 1)
    const grid = React.useRef<HTMLDivElement>(null)
    const go = (next: number) => { setPage(Math.max(0, Math.min(next, totalPages - 1))); grid.current?.scrollIntoView({ block: 'start' }) }
    return <>
        <div ref={grid} className="gl-library-grid" style={maxHeight > 0 ? { maxHeight, overflowY: 'auto' } : undefined}>{drawPagination ? items.slice(current * pageSize, (current + 1) * pageSize) : items}</div>
        {drawPagination && <div className="gl-library-pagination"><Button disabled={current === 0} label={t('page.xCloudLibrary.previousPageBtn')} onClick={() => go(current - 1)} /><span>{current + 1} / {totalPages}</span><Button disabled={current + 1 === totalPages} label={t('page.xCloudLibrary.nextPageBtn')} onClick={() => go(current + 1)} /></div>}
    </>
}
