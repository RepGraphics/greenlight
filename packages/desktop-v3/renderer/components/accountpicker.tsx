import {useEffect, useRef, useState} from 'react'
import Head from 'next/head'
import {ArrowRight, Plus, Trash2} from 'lucide-react'
import DashboardInput from '../../../desktop/renderer/components/ui/dashboardinput'
import {useAuth} from '../contexts/AuthContext'
import type {XboxAccount} from '../../shared/desktopcontracts'
import Brand from './brand'

export function AccountAvatar({account, name}: {account?: XboxAccount | null; name: string}) {
    return <span className="v3-account-icon" aria-hidden="true">
        {Array.from(name)[0]?.toLocaleUpperCase()}
        {account?.avatar && <img key={account.avatar} src={account.avatar} alt="" referrerPolicy="no-referrer" onError={event => {event.currentTarget.hidden = true}}/>}
    </span>
}

export default function AccountPicker({onAdd}: {onAdd: () => void}) {
    const {savedAccounts, canSaveAccounts, openAccount, removeAccount, logout} = useAuth()
    const [pending, setPending] = useState<{id: string; opening: boolean} | null>(null)
    const [error, setError] = useState('')
    const revision = useRef(0)
    const scope = useRef<HTMLElement>(null)
    const heading = useRef<HTMLHeadingElement>(null)
    const cancelButton = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        heading.current?.focus()
        return () => {revision.current++}
    }, [])
    useEffect(() => {
        if (pending?.opening) cancelButton.current?.focus()
    }, [pending])

    async function open(account: XboxAccount) {
        const attempt = ++revision.current
        setPending({id: account.id, opening: true})
        setError('')
        try {
            await openAccount(account.id)
        } catch {
            if (attempt === revision.current) {
                setError('Couldn’t open '+account.name+'. Try again, or sign in through Add account to reconnect this profile.')
            }
        } finally {
            if (attempt === revision.current) setPending(null)
        }
    }

    async function remove(account: XboxAccount) {
        if (!window.confirm('Remove '+account.name+' from Greenlight on this device?')) return
        const attempt = ++revision.current
        setPending({id: account.id, opening: false})
        setError('')
        try {
            await removeAccount(account.id)
        } catch {
            if (attempt === revision.current) setError('Couldn’t remove '+account.name+'. Try again.')
        } finally {
            if (attempt === revision.current) setPending(null)
        }
    }

    function cancel() {
        revision.current++
        logout()
        setPending(null)
        heading.current?.focus()
    }

    return <main className="v3-account-picker" ref={scope} onKeyDown={event => {
        if (pending?.opening && event.key === 'Escape') {event.preventDefault();cancel()}
    }}>
        <Head><title>Xbox accounts · Greenlight V3</title></Head>
        <DashboardInput enabled scope={scope} keyboardNavigation={false} onBack={pending?.opening ? cancel : undefined}/>
        <div className="v3-picker-inner">
            <header className="v3-picker-header">
                <Brand showVersion={false}/>
                <h1 tabIndex={-1} ref={heading}>Choose an Xbox account</h1>
                <p>Select a profile saved on this Windows device.</p>
            </header>
            {!canSaveAccounts && <p className="v3-notice" role="status">Saved accounts are temporarily unavailable. You can sign in with Microsoft for this session.</p>}
            {error && <p className="v3-notice" role="alert">{error}</p>}
            <div className="v3-account-grid" role="group" aria-label="Saved Xbox accounts">
                {savedAccounts.map(account => <article className="v3-account-card" key={account.id}>
                    <button type="button" className="v3-account-select" disabled={pending !== null || !canSaveAccounts}
                        onClick={() => void open(account)}>
                        <AccountAvatar account={account} name={account.name}/>
                        <span>{account.name}</span>
                        <ArrowRight size={18} aria-hidden="true"/>
                    </button>
                    <button type="button" className="v3-button v3-icon-button v3-account-remove" disabled={pending !== null}
                        aria-label={'Remove '+account.name} title={'Remove '+account.name} onClick={() => void remove(account)}>
                        <Trash2 size={16} aria-hidden="true"/>
                    </button>
                </article>)}
                <button type="button" disabled={pending !== null} className="v3-account-add" onClick={onAdd}>
                    <Plus size={21} aria-hidden="true"/> Add account
                </button>
            </div>
            {pending?.opening && <div className="v3-picker-progress">
                <p role="status"><span className="auth-spinner" aria-hidden="true"/> Opening {savedAccounts.find(account => account.id === pending.id)?.name}…</p>
                <button type="button" className="v3-button v3-button-secondary" ref={cancelButton} onClick={cancel}>Cancel</button>
            </div>}
        </div>
    </main>
}
