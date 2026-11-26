import React, {useEffect,useRef,useState} from 'react'
import Head from 'next/head'
import Sidebar from '../components/sidebar'
import RemotePlay from '../components/remoteplay'
import {useAuth} from '../contexts/AuthContext'
import {useTRPCClient} from '../utils/trpc'
import {AuthAttempt} from '../contexts/authattempt'
import {normalizeConsoles,searchConsoles,consoleReady,type ConsoleSummary} from '../utils/consoles'

export default function ConsolesPage(){
    const {getWebToken,isAuthenticated}=useAuth()
    const client=useTRPCClient()
    const {uhs,token}=getWebToken()
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
    return <React.Fragment>
        <Head><title>Greenlight — My Consoles</title></Head>
        <div className="flex min-h-screen flex-col md:h-screen md:flex-row bg-[#0d0d0d] text-white">
            <Sidebar/>
            <main className="flex-1 min-w-0 overflow-y-auto">
                <div className="p-4 md:p-8 max-w-5xl mx-auto">
                    <h1 className="text-2xl font-bold">My Consoles</h1>
                    <p className="text-white/60 mt-2">Discover Xbox consoles associated with your signed-in account.</p>
                    <p className="text-white/50 mt-2 text-sm">Experimental web client — Remote Play is unverified on hardware. Console power commands are not available here.</p>
                    <div className="flex flex-wrap gap-3 my-5">
                        <input type="search" aria-label="Search consoles" placeholder="Search consoles" value={search} onChange={event=>setSearch(event.target.value)} className="min-w-0 flex-1 rounded border border-white/20 bg-white/5 p-2"/>
                        <button type="button" disabled={loading||!token||!uhs} onClick={()=>void load()} className="rounded border border-white/20 px-4 py-2 disabled:opacity-50">{loading?'Refreshing…':'Refresh'}</button>
                    </div>
                    <section aria-busy={loading} aria-label="Xbox consoles">
                        {loading&&<p role="status">Loading consoles…</p>}
                        {(!token||!uhs)&&<p role="alert">Xbox account authorization is unavailable. Sign in again.</p>}
                        {failed&&<p role="alert">Unable to retrieve consoles. Check your connection and try again.</p>}
                        {!loading&&!failed&&token&&uhs&&items.length===0&&<p>No consoles were returned for this account.</p>}
                        {!loading&&!failed&&items.length>0&&visible.length===0&&<p>No consoles match your search.</p>}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {visible.map(item=><article key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                                <h2 className="text-lg font-semibold break-words">{item.name}</h2>
                                <p className="text-white/70 mt-2">Power: {item.powerState}</p>
                                <p className="text-white/70">Remote management: {item.remoteManagementEnabled?'Enabled':'Disabled'}</p>
                                <p className="text-white/70">Remote play: {item.consoleStreamingEnabled?'Enabled':'Disabled'}</p>
                                <p className="mt-3 text-sm">{consoleReady(item)?'Console reports remote-play readiness':'Enable remote features in Xbox settings'}</p>
                                <button type="button" disabled={!consoleReady(item)||loading} className="mt-3 rounded border border-white/20 px-4 py-2 disabled:opacity-50" onClick={()=>setSelected(item)}>Remote Play (experimental)</button>
                            </article>)}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    </React.Fragment>
}
