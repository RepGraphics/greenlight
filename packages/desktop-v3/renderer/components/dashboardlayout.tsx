import { useCallback, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/router'
import DashboardInput from '../../../desktop/renderer/components/ui/dashboardinput'
import Sidebar from './sidebar'

export default function DashboardLayout({ page, children }: { page: 'home' | 'consoles'; children: ReactNode }) {
    const scope = useRef<HTMLDivElement>(null)
    const router = useRouter()
    const goToDashboard = useCallback(() => {
        if (page === 'consoles') void router.push('/home/')
    }, [page, router])

    return <div ref={scope} className="gl-web-dashboard flex h-[100dvh] flex-col md:flex-row bg-[#0d0d0d] text-white overflow-hidden">
        <DashboardInput enabled scope={scope} keyboardNavigation={false} onBack={goToDashboard} />
        <Sidebar page={page} />
        <main className="flex-1 min-h-0 min-w-0 overflow-y-auto p-4 md:p-8">{children}</main>
    </div>
}
