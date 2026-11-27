import {useEffect,useRef,useState} from 'react'
import Head from 'next/head'
import {ArrowRight, Gamepad2, Power, RefreshCw, Search} from 'lucide-react'
import DashboardLayout from '../components/dashboardlayout'
import RemotePlay from '../components/remoteplay'
import {useAuth} from '../contexts/AuthContext'
import {useTRPCClient} from '../utils/trpc'
import {AuthAttempt} from '../contexts/authattempt'
import {normalizeConsoles,searchConsoles,consoleReady,type ConsoleSummary} from '../utils/consoles'

export default function ConsolesPage(){
    const {getWebToken,getxHomeToken,isAuthenticated}=useAuth()
    const client=useTRPCClient()
    const {uhs,token}=getWebToken()
    const streamingAvailable=Boolean(getxHomeToken().token)
    const [items,setItems]=useState<ConsoleSummary[]>([])
    const [loading,setLoading]=useState(true)
    const [failed,setFailed]=useState(false)
    const [search,setSearch]=useState('')
    const [selected,setSelected]=useState<ConsoleSummary|null>(null)
    const attempts=useRef(new AuthAttempt())
    const locked=useRef(false)
    // Never put bearer tokens into a query-cache key or browser storage.
    const load=async()=>{
        if(locked.current||!isAuthenticated||!token||!uhs)return
        locked.current=true
        const attempt=attempts.current.begin()
        setLoading(true);setFailed(false)
        try{
            const response=await client.smartglass_consoles_list.query({uhs,token},{signal:attempt.signal})
            if(attempt.current())setItems(normalizeConsoles(response))
        }catch{
            if(attempt.current()){setItems([]);setFailed(true)}
        }finally{
            if(attempt.current()){locked.current=false;setLoading(false)}
        }
    }
    useEffect(()=>{
        setItems([]);setFailed(false)
        if(isAuthenticated&&token&&uhs)void load()
        else setLoading(false)
        return()=>{attempts.current.cancel();locked.current=false}
    },[client,isAuthenticated,uhs,token])
    const visible=searchConsoles(items,search)
    if(selected)return <RemotePlay target={{id:selected.id,name:selected.name,type:'home'}} onExit={()=>setSelected(null)}/>
    return <DashboardLayout>
        <Head><title>Greenlight — My Consoles</title></Head>
        <header className="v3-page-header">
            <div><h1>My Consoles</h1><p>Stream games from your own Xbox with Remote Play.</p></div>
            <button type="button" className="v3-button v3-button-secondary" disabled={loading||!token||!uhs} onClick={()=>void load()}><RefreshCw size={16} aria-hidden="true"/> Refresh</button>
        </header>
        <div className="v3-filters v3-section-spacing">
            <label className="v3-search"><Search size={17} aria-hidden="true"/>
                <input type="search" className="v3-field" aria-label="Search consoles" placeholder="Search consoles" maxLength={100} value={search} onChange={event=>setSearch(event.target.value)}/>
            </label>
        </div>
        <section aria-busy={loading} aria-label="Xbox consoles" className="v3-section-spacing">
            {loading&&<p role="status">Loading consoles…</p>}
            {(!token||!uhs)&&<p className="v3-notice" role="alert">Xbox account authorization is unavailable. Sign in again.</p>}
            {token&&uhs&&!streamingAvailable&&<p className="v3-notice" role="status">Remote Play authorization is unavailable for this account.</p>}
            {failed&&<p className="v3-notice" role="alert">Unable to retrieve consoles. Check your connection and try again.</p>}
            {!loading&&!failed&&token&&uhs&&visible.length===0&&<div className="v3-panel v3-empty">
                <Gamepad2 size={32} aria-hidden="true"/>
                <h2>{items.length===0?'No consoles found':'No matching consoles'}</h2>
                <p>{items.length===0?'Sign in on your Xbox and turn on remote features in its settings, then refresh.':'Try another console name.'}</p>
            </div>}
            <div className="v3-console-grid">
                {visible.map(item=>{
                    const ready=consoleReady(item)
                    return <article key={item.id} className="v3-panel v3-console-card">
                        <div className="v3-console-heading">
                            <span className="v3-console-icon"><Gamepad2 size={26} aria-hidden="true"/></span>
                            <div><h2>{item.name}</h2><p><Power size={14} aria-hidden="true"/> {item.powerState}</p></div>
                        </div>
                        <p className={ready?'v3-console-ready':'v3-muted'}>{ready?'Remote features enabled':'Enable remote features on this Xbox to connect.'}</p>
                        <button type="button" disabled={!ready||!streamingAvailable||loading} className="v3-button v3-button-primary" onClick={()=>setSelected(item)}>Remote Play <ArrowRight size={16} aria-hidden="true"/></button>
                    </article>
                })}
            </div>
        </section>
    </DashboardLayout>
}
