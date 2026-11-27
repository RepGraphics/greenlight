import {useEffect,useRef,useState} from 'react'
import Head from 'next/head'
import QRCode from 'react-qr-code'
import {useAuth} from '../../contexts/AuthContext'
import {microsoftDeviceLogin,deviceLoginSetupTimeoutMs,readDeviceLogin,remainingDeviceLoginSeconds} from '../../utils/devicelogin'

export default function HomePage(){
    const {startAuth,verifyCode,logout}=useAuth()
    const [userCode,setUserCode]=useState('')
    const [remaining,setRemaining]=useState(0)
    const [busy,setBusy]=useState(false)
    const [failed,setFailed]=useState('')
    const [copy,setCopy]=useState<'idle'|'success'|'failed'>('idle')
    const generation=useRef(0)
    const locked=useRef(false)
    const timer=useRef<ReturnType<typeof setInterval>|undefined>(undefined)
    const clearTimer=()=>{if(timer.current!==undefined){clearInterval(timer.current);timer.current=undefined}}
    useEffect(()=>()=>{generation.current++;locked.current=false;clearTimer()},[])
    const reset=(message='')=>{
        generation.current++;locked.current=false;clearTimer()
        logout();setUserCode('');setRemaining(0);setBusy(false);setCopy('idle');setFailed(message)
    }
    const start=async()=>{
        if(locked.current)return
        locked.current=true
        const epoch=++generation.current
        setBusy(true);setFailed('');setUserCode('');setCopy('idle');setRemaining(0)
        const startDeadline=performance.now()+deviceLoginSetupTimeoutMs
        timer.current=setInterval(()=>{
            if(epoch===generation.current&&performance.now()>=startDeadline)reset('Could not retrieve a device code. Check the private backend and retry.')
        },250)
        try{
            const raw=await startAuth()
            if(epoch!==generation.current)return
            clearTimer()
            const flow=readDeviceLogin(raw)
            if(!flow)throw Error('Invalid device authorization response')
            const deadline=performance.now()+flow.expiresIn*1000
            setUserCode(flow.userCode);setRemaining(flow.expiresIn)
            timer.current=setInterval(()=>{
                if(epoch!==generation.current)return
                const seconds=remainingDeviceLoginSeconds(deadline,performance.now())
                setRemaining(seconds)
                if(seconds===0)reset('Device-code sign-in expired. Start a new sign-in.')
            },1000)
            const result=await verifyCode(flow.deviceCode)
            if(epoch===generation.current&&!result)throw Error('Authentication unavailable')
        }catch{
            if(epoch===generation.current)reset('Sign-in failed or expired. Try again.')
        }finally{
            if(epoch===generation.current){clearTimer();locked.current=false;setBusy(false);setUserCode('');setRemaining(0)}
        }
    }
    const copyCode=async()=>{
        const epoch=generation.current
        try{await navigator.clipboard.writeText(userCode);if(epoch===generation.current)setCopy('success')}
        catch{if(epoch===generation.current)setCopy('failed')}
    }
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    return <>
        <Head><title>Greenlight — Microsoft sign-in</title></Head>
        <main className="min-h-[100dvh] bg-[#0d0d0d] text-white p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-2xl font-bold">Sign in to Xbox</h1>
                <p className="text-white/60 my-3">Use Microsoft device authorization. Enter your password only on Microsoft's official sign-in page. Never share your device code or enter a code provided by someone else.</p>
                {failed&&<p role="alert" className="my-3 rounded border border-white/20 p-3">{failed}</p>}
                {!busy&&<button type="button" className={button} onClick={()=>void start()}>Sign in with Microsoft</button>}
                {busy&&!userCode&&<p role="status" className="my-3">Retrieving login details…</p>}
                {userCode&&<div className="rounded-xl border border-white/10 bg-white/5 p-4 grid gap-4 my-4">
                    <p>Open the official Microsoft page and enter this code to authorize your own sign-in:</p>
                    <code className="text-2xl font-bold tracking-wider break-all select-all">{userCode}</code>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" className={button} onClick={()=>void copyCode()}>Copy code</button>
                        <a className={button} href={microsoftDeviceLogin} target="_blank" rel="noopener noreferrer">Open Microsoft device sign-in</a>
                    </div>
                    {copy!=='idle'&&<p role="status">{copy==='success'?'Code copied.':'Select and copy the code manually.'}</p>}
                    <p>Code expires in {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</p>
                    <p className="text-sm text-white/60">Android companion: use the native Open Microsoft device sign-in button. On another device, scan this QR code to open the official page, then enter the code above.</p>
                    <div className="w-fit bg-white p-3 rounded"><QRCode value={microsoftDeviceLogin} size={144} bgColor="#ffffff" fgColor="#000000"/></div>
                    <p role="status">Waiting for Microsoft authorization…</p>
                </div>}
                {busy&&<button type="button" className={button+' mt-3'} onClick={()=>reset()}>Cancel sign-in</button>}
            </div>
        </main>
    </>
}
