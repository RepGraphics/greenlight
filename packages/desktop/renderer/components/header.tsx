import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslation } from 'react-i18next'
import Ipc from '../lib/ipc'
import BrandMark from './ui/brandmark'
import { brandName } from '../lib/brand'

interface HeaderProps {
    hidden?: boolean;
    gamertag: string;
    gamerpic?: string;
    level: number;
}

export default function Header({ hidden = false, gamertag, gamerpic, level = 0 }: HeaderProps) {
    const { t } = useTranslation()
    const router = useRouter()
    const links = [
        { name: t('header.myConsoles'), url: '/home', icon: 'fa-gamepad' },
        ...(level > 1 ? [{ name: t('header.xCloudLibrary'), url: '/xcloud/home', icon: 'fa-cloud' }] : []),
        { name: t('dashboard.achievements'), url: '/achievements', icon: 'fa-trophy' },
        { name: t('dashboard.social'), url: '/social', icon: 'fa-users' },
        { name: t('header.settings'), url: '/settings/home', icon: 'fa-gear' },
    ]
    const isActive = (url: string) => router.pathname === url || (url === '/achievements' && router.pathname.startsWith('/achievements/')) || (url.startsWith('/xcloud') && router.pathname.startsWith('/xcloud/')) || (url.startsWith('/settings') && router.pathname.startsWith('/settings/'))
    return (
        <nav id="component_header" className={hidden ? 'disabled' : ''} aria-label="Main navigation">
            <Link href="/home" className="gl-brand" aria-label={brandName+' home'}>
                <BrandMark size={30} decorative/>
                <span>{brandName}</span>
            </Link>
            <ul className="menu gl-nav">
                {links.map(link => (
                    <li key={link.url}>
                        <Link href={link.url} className={isActive(link.url) ? 'active' : ''} aria-current={isActive(link.url) ? 'page' : undefined}>
                            <i className={'fa-solid ' + link.icon} aria-hidden="true" />
                            <span>{link.name}</span>
                        </Link>
                    </li>
                ))}
            </ul>
            <Link href="/profile" className={'gl-account ' + (router.pathname === '/profile' ? 'active' : '')} aria-current={router.pathname === '/profile' ? 'page' : undefined}>
                <span className="gl-avatar gl-avatar-small">
                    {gamerpic ? <img src={gamerpic} alt="" onError={e => { e.currentTarget.style.display = 'none' }} /> : null}
                    <i className="fa-solid fa-user" aria-hidden="true" />
                </span>
                <span>{gamertag}</span>
            </Link>
            <button type="button" className="gl-quit" title={t('header.quitQuestion')} aria-label={t('header.quitQuestion')} onClick={() => {
                if (window.Greenlight && !window.Greenlight.isWebUI() && confirm(t('header.quitQuestion'))) {
                    void Ipc.send('app', 'quit')
                }
            }}><i className="fa-solid fa-power-off" aria-hidden="true" /></button>
        </nav>
    )
}
