import {useEffect,useRef,useState} from 'react'
import Head from 'next/head'
import DashboardLayout from '../components/dashboardlayout'
import RemotePlay from '../components/remoteplay'
import {useAuth} from '../contexts/AuthContext'
import {useTRPCClient} from '../utils/trpc'
import {AuthAttempt} from '../contexts/authattempt'
import {normalizeCloudTitles,catalogBatches,hydrateCloudTitles,filterCloudTitles,type CloudTitle} from '../utils/cloudlibrary'

import {libraryView,type LibraryView} from '../utils/librarycollections'

export default function HomePage(){
    const {getxCloudToken,isAuthenticated,libraryCollections,toggleLibraryFavorite,rememberLibraryTitle,clearLibraryCollections}=useAuth()
    const client=useTRPCClient()
    const {token,market,language}=getxCloudToken()
    const [titles,setTitles]=useState<CloudTitle[]>([])
    const [loading,setLoading]=useState(false)
    const [failed,setFailed]=useState(false)
    const [metadataFailed,setMetadataFailed]=useState(false)
    const [search,setSearch]=useState('')
    const [entitledOnly,setEntitledOnly]=useState(true)
    const [sort,setSort]=useState<'az'|'za'>('az')
    const [page,setPage]=useState(0)
    const [view,setView]=useState<LibraryView>('all')
    const [selected,setSelected]=useState<CloudTitle|null>(null)
    const attempts=useRef(new AuthAttempt())
    const locked=useRef(false)
    const load=async()=>{
        if(locked.current||!isAuthenticated||!token)return
        locked.current=true
        const attempt=attempts.current.begin()
        const credentials={token,market,language}
        setLoading(true);setFailed(false);setMetadataFailed(false);setTitles([]);setPage(0)
        try{
            let items=normalizeCloudTitles(await client.gamepass_get_titles.query(credentials,{signal:attempt.signal}))
            if(!attempt.current())return
            setTitles(items)
            // Resolve metadata sequentially in bounded batches. The title list
            // remains usable if the metadata service fails or returns partially.
            for(const productIds of catalogBatches(items)){
                if(!attempt.current())return
                try{
                    const response=await client.gamepass_batch_productids.query({token:credentials,productIds},{signal:attempt.signal})
                    if(!attempt.current())return
                    items=hydrateCloudTitles(items,response)
                    setTitles(items)
                }catch{
                    if(!attempt.current())return
                    setMetadataFailed(true)
                    break
                }
            }
        }catch{
            if(attempt.current()){setTitles([]);setFailed(true)}
        }finally{
            if(attempt.current()){locked.current=false;setLoading(false)}
        }
    }
    useEffect(()=>{
        setTitles([]);setFailed(false);setMetadataFailed(false);setPage(0)
        if(isAuthenticated&&token)void load()
        else setLoading(false)
        return()=>{attempts.current.cancel();locked.current=false}
    },[client,isAuthenticated,token,market,language])
    const visible=libraryView(filterCloudTitles(titles,search,entitledOnly,sort),libraryCollections,view)
    const pageSize=48
    const lastPage=Math.max(0,Math.ceil(visible.length/pageSize)-1)
    const currentPage=Math.min(page,lastPage)
    const button='rounded border border-white/20 px-4 py-2 disabled:opacity-50'
    if(selected)return <RemotePlay target={{id:selected.id,name:selected.name,type:'cloud',entitled:selected.entitled}} onExit={()=>setSelected(null)}/>
    return <>
        <Head><title>Greenlight — Cloud Gaming library</title></Head>
        <DashboardLayout page="home">
                <h1 className="text-2xl font-bold">Cloud Gaming library</h1>
                <p className="text-white/60 mt-2">Experimental web client — Cloud Gaming launch is unverified on hardware.</p>
                {!token?<p className="mt-5" role="status">Cloud Gaming authorization is unavailable for this account.</p>:<>
                    <div className="flex flex-wrap gap-3 my-5 items-center">
                        <input type="search" maxLength={100} value={search} onChange={event=>{setSearch(event.target.value);setPage(0)}} aria-label="Search games" placeholder="Search games or publishers" className="min-w-0 flex-1 rounded border border-white/20 bg-white/5 p-2"/>
                        <label><input type="checkbox" checked={entitledOnly} onChange={event=>{setEntitledOnly(event.target.checked);setPage(0)}}/> Entitled and free titles</label>
                        <label>Collection <select value={view} onChange={event=>{setView(event.target.value==='favorites'||event.target.value==='recent'?event.target.value:'all');setPage(0)}} className="bg-[#202020] rounded p-2"><option value="all">All games</option><option value="favorites">Favourites</option><option value="recent">Recently opened</option></select></label>
                        <label>Sort <select disabled={view==='recent'} value={sort} onChange={event=>{setSort(event.target.value==='za'?'za':'az');setPage(0)}} className="bg-[#202020] rounded p-2"><option value="az">A–Z</option><option value="za">Z–A</option></select></label>
                        <button type="button" className={button} disabled={loading} onClick={()=>void load()}>{loading?'Refreshing…':'Refresh'}</button>
                    </div>
                    <p className="text-sm text-white/60">Favourites and recently opened games are remembered only during this sign-in. Recently opened means session setup was opened, not necessarily played.</p>
                    {(libraryCollections.favorites.length>0||libraryCollections.recent.length>0)&&<button type="button" className={button+' my-2'} onClick={()=>{clearLibraryCollections();setPage(0)}}>Clear favourites and recent games</button>}
                    <p role="status">{loading?'Loading catalog and metadata…':visible.length+' matching titles'}</p>
                    {failed&&<p role="alert" className="my-3">Unable to retrieve the Xbox catalog. Try refreshing.</p>}
                    {metadataFailed&&<p role="status" className="my-3">Some game names are unavailable. Title identifiers are shown instead.</p>}
                    {!loading&&!failed&&visible.length===0&&<p>No matching titles.</p>}
                    <section aria-busy={loading} aria-label="Cloud games" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
                        {visible.slice(currentPage*pageSize,(currentPage+1)*pageSize).map(title=><article key={title.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <h2 className="font-semibold break-words">{title.name}</h2>
                            {title.publisher&&<p className="text-white/60 text-sm">{title.publisher}</p>}
                            <p className="text-sm mt-2">{title.entitled?'Available entitlement or free title':'Entitlement not reported'}</p>
                            <button type="button" disabled={!title.entitled||!token||loading} className={button+' mt-3'} onClick={()=>{rememberLibraryTitle(title.id);setSelected(title)}}>Play (experimental)</button>
                            <button type="button" aria-pressed={libraryCollections.favorites.includes(title.id)} className={button+' mt-3 ml-2'} onClick={()=>toggleLibraryFavorite(title.id)}>{libraryCollections.favorites.includes(title.id)?'Remove favourite':'Add favourite'}</button>
                        </article>)}
                    </section>
                    {lastPage>0&&<nav aria-label="Game pages" className="flex flex-wrap gap-3 items-center mt-5">
                        <button type="button" className={button} disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button>
                        <span>Page {currentPage+1} of {lastPage+1}</span>
                        <button type="button" className={button} disabled={currentPage===lastPage} onClick={()=>setPage(currentPage+1)}>Next</button>
                    </nav>}
                </>}
        </DashboardLayout>
    </>
}
