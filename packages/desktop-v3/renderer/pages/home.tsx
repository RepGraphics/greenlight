import {useEffect,useRef,useState} from 'react'
import Head from 'next/head'
import Link from 'next/link'
import {ChevronLeft, ChevronRight, Cloud, History, LayoutGrid, Play, RefreshCw, Search, Star} from 'lucide-react'
import DashboardLayout from '../components/dashboardlayout'
import GameArt from '../components/gameart'
import GameDetails from '../components/gamedetails'
import RemotePlay from '../components/remoteplay'
import {useAuth} from '../contexts/AuthContext'
import {useTRPCClient} from '../utils/trpc'
import {AuthAttempt} from '../contexts/authattempt'
import {normalizeCloudTitles,catalogBatches,hydrateCloudTitles,filterCloudTitles,type CloudTitle} from '../utils/cloudlibrary'

import {libraryView,type LibraryView} from '../utils/librarycollections'

const collections = [
    {id: 'all', label: 'All games', Icon: LayoutGrid},
    {id: 'favorites', label: 'Favourites', Icon: Star},
    {id: 'recent', label: 'Recently opened', Icon: History},
] as const

export default function HomePage(){
    const {getxCloudToken,isAuthenticated,libraryCollections,toggleLibraryFavorite,rememberLibraryTitle,clearLibraryCollections}=useAuth()
    const client=useTRPCClient()
    const {token,market,language}=getxCloudToken()
    const [titles,setTitles]=useState<CloudTitle[]>([])
    const [loading,setLoading]=useState(true)
    const [refreshing,setRefreshing]=useState(false)
    const [failed,setFailed]=useState(false)
    const [metadataFailed,setMetadataFailed]=useState(false)
    const [search,setSearch]=useState('')
    const [entitledOnly,setEntitledOnly]=useState(true)
    const [sort,setSort]=useState<'az'|'za'>('az')
    const [page,setPage]=useState(0)
    const [view,setView]=useState<LibraryView>('all')
    const [detailsId,setDetailsId]=useState<string|null>(null)
    const [selected,setSelected]=useState<CloudTitle|null>(null)
    const attempts=useRef(new AuthAttempt())
    const locked=useRef(false)
    const load=async()=>{
        if(locked.current||!isAuthenticated||!token)return
        locked.current=true
        const attempt=attempts.current.begin()
        const credentials={token,market,language}
        setLoading(true);setRefreshing(true);setFailed(false);setMetadataFailed(false);setTitles([]);setPage(0)
        try{
            let items=normalizeCloudTitles(await client.gamepass_get_titles.query(credentials,{signal:attempt.signal}))
            if(!attempt.current())return
            setTitles(items)
            setLoading(false)
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
            if(attempt.current()){locked.current=false;setLoading(false);setRefreshing(false)}
        }
    }
    useEffect(()=>{
        setTitles([]);setFailed(false);setMetadataFailed(false);setPage(0)
        if(isAuthenticated&&token)void load()
        else {setLoading(false);setRefreshing(false)}
        return()=>{attempts.current.cancel();locked.current=false}
    },[client,isAuthenticated,token,market,language])
    const visible=libraryView(filterCloudTitles(titles,search,entitledOnly,sort),libraryCollections,view)
    const pageSize=24
    const lastPage=Math.max(0,Math.ceil(visible.length/pageSize)-1)
    const currentPage=Math.min(page,lastPage)
    const details=titles.find(title=>title.id===detailsId)
    const featured=view==='all'&&!search.trim()&&currentPage===0
        ? visible.find(title=>title.entitled&&title.hero) ?? visible.find(title=>title.entitled)
        : undefined
    const openStream=(title:CloudTitle)=>{
        if(!token||!title.entitled)return
        rememberLibraryTitle(title.id)
        setDetailsId(null)
        setSelected(title)
    }
    const refresh=<button type="button" className="v3-button v3-button-secondary" disabled={refreshing||loading} onClick={()=>void load()}><RefreshCw size={16} aria-hidden="true"/> Refresh</button>
    const emptyHeading=search.trim()?'No matching games':view==='favorites'?'No favourites yet':view==='recent'?'No recently opened games':'No games available'
    const emptyDescription=search.trim()?'Try another game or publisher.':view==='favorites'?'Select the star on a game to add it here.':view==='recent'?'Games appear here after you open their stream setup.':'Try changing the availability filter.'
    if(selected)return <RemotePlay target={{id:selected.id,name:selected.name,type:'cloud',entitled:selected.entitled}} onExit={()=>setSelected(null)}/>
    return <DashboardLayout>
        <Head><title>Greenlight — Cloud Gaming library</title></Head>
        <header className="v3-page-header">
            <h1>Cloud Gaming</h1>
            {token&&refresh}
        </header>
        {!token?<section className="v3-empty v3-panel">
            <Cloud size={32} aria-hidden="true"/><h2>Cloud Gaming is unavailable</h2>
            <p>Xbox didn’t provide Cloud Gaming access for this sign-in.</p>
            <Link href="/consoles/" className="v3-button v3-button-primary">Open My Consoles</Link>
        </section>:<>
            {featured&&<section className={featured.hero||featured.cover?'v3-feature v3-feature-with-art':'v3-feature'}>
                <GameArt src={featured.hero??featured.cover} lazy={false}/>
                <div className="v3-feature-content">
                    <h2>{featured.name}</h2>
                    {featured.publisher&&<p>{featured.publisher}</p>}
                    <div className="v3-actions">
                        <button type="button" className="v3-button v3-button-primary" onClick={()=>openStream(featured)}><Play size={17} aria-hidden="true"/> Play</button>
                        <button type="button" className="v3-button v3-button-secondary" onClick={()=>setDetailsId(featured.id)}>Game details</button>
                    </div>
                </div>
            </section>}
            <div className="v3-library-tools">
                <div className="v3-collections" role="group" aria-label="Library collections">
                    {collections.map(({id,label,Icon})=><button type="button" key={id} aria-pressed={id===view} onClick={()=>{setView(id);setPage(0)}}><Icon size={17} aria-hidden="true"/>{label}</button>)}
                </div>
                <div className="v3-filters">
                    <label className="v3-search">
                        <Search size={17} aria-hidden="true"/>
                        <input type="search" className="v3-field" maxLength={100} value={search} onChange={event=>{setSearch(event.target.value);setPage(0)}} aria-label="Search games" placeholder="Search games or publishers"/>
                    </label>
                    <select className="v3-field" aria-label="Availability" value={entitledOnly?'available':'all'} onChange={event=>{setEntitledOnly(event.target.value==='available');setPage(0)}}>
                        <option value="available">Playable games</option><option value="all">All availability</option>
                    </select>
                    {view!=='recent'&&<select className="v3-field" aria-label="Sort games" value={sort} onChange={event=>{setSort(event.target.value==='za'?'za':'az');setPage(0)}}>
                        <option value="az">A–Z</option><option value="za">Z–A</option>
                    </select>}
                </div>
            </div>
            <div className="v3-library-summary">
                <p role="status">{loading?'Loading Xbox catalog…':failed?'':visible.length+' '+(visible.length===1?'game':'games')+(refreshing?' · Loading artwork…':'')}</p>
                {view!=='all'&&(libraryCollections.favorites.length>0||libraryCollections.recent.length>0)&&<button type="button" className="v3-text-button" onClick={()=>{if(window.confirm('Clear your favourites and recently opened games?')){clearLibraryCollections();setPage(0)}}}>Clear collections</button>}
            </div>
            {failed&&<section className="v3-empty v3-panel" role="alert"><h2>Couldn’t load the Xbox catalog</h2><p>Check your connection and refresh to try again.</p></section>}
            {metadataFailed&&<p role="status" className="v3-notice">Some titles are missing names or artwork. Refresh to try again.</p>}
            {!loading&&!refreshing&&!failed&&visible.length===0&&<section className="v3-empty v3-panel">
                <h2>{emptyHeading}</h2><p>{emptyDescription}</p>
            </section>}
            {loading&&<div className="v3-game-grid" aria-hidden="true">{Array.from({length:4},(_,index)=><div key={index} className="v3-game-skeleton"/>)}</div>}
            <section aria-busy={loading} aria-label="Cloud games" className="v3-game-grid">
                {visible.slice(currentPage*pageSize,(currentPage+1)*pageSize).map(title=>{
                    const favorite=libraryCollections.favorites.includes(title.id)
                    return <article key={title.id} className="v3-game-card">
                        <button type="button" className="v3-game-link" onClick={()=>setDetailsId(title.id)}>
                            <GameArt src={title.cover??title.hero}/>
                            <span className="v3-game-card-body">
                                <strong>{title.name}</strong>
                                <small>{title.entitled?title.publisher||'Cloud Gaming':'Cloud access unavailable'}</small>
                            </span>
                        </button>
                        <button type="button" className="v3-button v3-icon-button v3-favorite" aria-label={title.name+' favourite'} title={favorite?'Remove from favourites':'Add to favourites'} aria-pressed={favorite} onClick={()=>toggleLibraryFavorite(title.id)}><Star size={17} fill={favorite?'currentColor':'none'} aria-hidden="true"/></button>
                    </article>
                })}
            </section>
            {lastPage>0&&<nav aria-label="Game pages" className="v3-pagination">
                <button type="button" className="v3-button v3-button-secondary" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={17} aria-hidden="true"/> Previous</button>
                <span>Page {currentPage+1} of {lastPage+1}</span>
                <button type="button" className="v3-button v3-button-secondary" disabled={currentPage===lastPage} onClick={()=>setPage(currentPage+1)}>Next <ChevronRight size={17} aria-hidden="true"/></button>
            </nav>}
            {details&&<GameDetails title={details} favorite={libraryCollections.favorites.includes(details.id)} onClose={()=>setDetailsId(null)} onFavorite={()=>toggleLibraryFavorite(details.id)} onPlay={()=>openStream(details)}/>}
        </>}
    </DashboardLayout>
}
