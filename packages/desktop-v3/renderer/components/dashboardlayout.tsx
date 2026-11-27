import {useCallback, useRef, type ReactNode} from 'react'
import {useRouter} from 'next/router'
import DashboardInput from '../../../desktop/renderer/components/ui/dashboardinput'
import Sidebar from './sidebar'

export default function DashboardLayout({children}: {children: ReactNode}) {
    const scope = useRef<HTMLDivElement>(null)
    const router = useRouter()
    const goHome = useCallback(() => {
        if (router.pathname !== '/home') void router.push('/home/')
    }, [router])

    return <div className="v3-dashboard" ref={scope}>
        <DashboardInput enabled scope={scope} keyboardNavigation={false} onBack={goHome}/>
        <Sidebar/>
        <main id="dashboard-content" className="v3-dashboard-content">
            <div className="v3-dashboard-inner">{children}</div>
        </main>
    </div>
}
