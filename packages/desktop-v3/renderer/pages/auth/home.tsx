import {useEffect, useRef, useState} from 'react'
import QRCode from 'react-qr-code'
import {deviceCodeDetails,deviceCodeRemaining,deviceCodeSetupTimeoutMs} from '../../../shared/devicesignin'
import AuthLayout from '../../components/authlayout'
import {useAuth} from '../../contexts/AuthContext'

type SignInState = {phase: 'idle' | 'requesting' | 'failed'} | {phase: 'code'; code: string; url: string}

export default function AuthHome({onBack}: {onBack?: () => void}) {
    const {startAuth, verifyCode, logout, desktop, canSaveAccounts} = useAuth()
    const [state, setState] = useState<SignInState>({phase: 'idle'})
    const [copyStatus, setCopyStatus] = useState('')
    const [remaining,setRemaining]=useState(0)
    const timer=useRef<ReturnType<typeof setInterval>|undefined>(undefined)
    const clearTimer=()=>{if(timer.current!==undefined){clearInterval(timer.current);timer.current=undefined}}
    const generation = useRef(0)
    const locked = useRef(false)
    const heading = useRef<HTMLHeadingElement>(null)
    const primaryButton = useRef<HTMLButtonElement>(null)
    const restoreFocus = useRef(false)

    useEffect(() => () => {generation.current++; locked.current = false;clearTimer()}, [])
    useEffect(() => {
        if (state.phase === 'code' || state.phase === 'failed') heading.current?.focus()
        if (state.phase === 'idle' && restoreFocus.current) {
            primaryButton.current?.focus()
            restoreFocus.current = false
        }
    }, [state.phase])

    const fail=()=>{
        generation.current++;locked.current=false;clearTimer();logout();setRemaining(0)
        setState({phase:'failed'});setCopyStatus('')
    }
    const start = async () => {
        if (locked.current) return
        locked.current = true
        const epoch = ++generation.current
        setState({phase: 'requesting'})
        setCopyStatus('');setRemaining(0)
        const setupDeadline=performance.now()+deviceCodeSetupTimeoutMs
        timer.current=setInterval(()=>{if(epoch===generation.current&&performance.now()>=setupDeadline)fail()},250)
        try {
            const flow = await startAuth()
            if (epoch !== generation.current) return
            clearTimer()
            const details=deviceCodeDetails(flow,!desktop)
            if(!details)throw Error('Sign-in code unavailable')
            const deadline=performance.now()+details.expires_in*1000
            setRemaining(details.expires_in)
            setState({phase:'code',code:details.user_code,url:details.verification_uri})
            timer.current=setInterval(()=>{if(epoch!==generation.current)return;const seconds=deviceCodeRemaining(deadline,performance.now());setRemaining(seconds);if(seconds===0)fail()},1000)
            const result = await verifyCode(details.device_code)
            if (epoch === generation.current && !result) throw Error('Sign-in incomplete')
        } catch {
            if (epoch === generation.current) fail()
        } finally {
            if (epoch === generation.current) {locked.current = false;clearTimer()}
        }
    }

    const cancel = () => {
        generation.current++
        locked.current = false
        clearTimer();setRemaining(0)
        restoreFocus.current = true
        logout()
        setState({phase: 'idle'})
        setCopyStatus('')
    }

    const copyCode = async (code: string) => {
        const epoch = generation.current
        let message = 'Code copied.'
        try {
            await navigator.clipboard.writeText(code)
        } catch {
            message = 'Select the code to copy it manually.'
        }
        if (epoch === generation.current) setCopyStatus(message)
    }

    const cancelButton = <button type="button" className="v3-button v3-button-secondary" onClick={cancel}>Cancel sign-in</button>
    return <AuthLayout>
        {state.phase === 'code' ? <>
            <h2 id="auth-heading" ref={heading} tabIndex={-1}>Enter your sign-in code</h2>
            <p>Open Microsoft sign-in, enter this code, then return to Greenlight. Never enter a code provided by someone else or share your sign-in code.</p>
            <div className="auth-code-row">
                <code aria-label="Sign-in code">{state.code}</code>
                <button type="button" className="v3-button v3-button-secondary" onClick={() => void copyCode(state.code)}>Copy code</button>
            </div>
            <p>Code expires in {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</p>
            {copyStatus && <p className="auth-copy-status" role="status">{copyStatus}</p>}
            <a className="v3-button v3-button-primary auth-primary" href={state.url} target="_blank" rel="noopener noreferrer">Open Microsoft sign-in <span aria-hidden="true">↗</span></a>
            <details className="auth-phone">
                <summary>Use a phone instead</summary>
                <div className="auth-phone-content">
                    <div className="auth-qr"><QRCode value={state.url} size={100} role="img" aria-label="QR code for Microsoft device sign-in"/></div>
                    <p>Scan the QR code, then enter the sign-in code above.</p>
                </div>
            </details>
            <div className="auth-actions">
                <p className="auth-status" role="status"><span className="auth-spinner" aria-hidden="true"/> Waiting for Microsoft…</p>
                {cancelButton}
            </div>
        </> : <>
            <h2 id="auth-heading" ref={heading} tabIndex={-1}>{state.phase === 'requesting' ? 'Getting your sign-in code' : onBack ? 'Add an Xbox account' : 'Sign in'}</h2>
            {state.phase === 'requesting' ? <>
                <p className="auth-status" role="status"><span className="auth-spinner" aria-hidden="true"/> Requesting a code from Microsoft…</p>
                <div className="auth-actions">{cancelButton}</div>
            </> : <>
                <p>{onBack ? 'Use the Microsoft account for the Xbox profile you want to add.' : 'Use the Microsoft account you use for Xbox.'}</p>
                {state.phase === 'failed' && <p className="auth-error" role="alert">Sign-in couldn’t finish. Request a new code to try again.</p>}
                <button ref={primaryButton} type="button" className="v3-button v3-button-primary auth-primary" onClick={() => void start()}>
                    {state.phase === 'failed' ? 'Try again' : 'Sign in with Microsoft'}
                </button>
                {desktop && !canSaveAccounts && <p className="auth-storage-note">Sign-in is available for this session.</p>}
                {onBack && <button type="button" className="v3-button v3-button-secondary auth-picker-back" onClick={onBack}>Back to Xbox accounts</button>}
            </>}
        </>}
    </AuthLayout>
}
