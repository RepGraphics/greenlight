import type {CloudTitle} from './cloudlibrary'
export type LibraryCollections={favorites:string[];recent:string[]}
export type LibraryView='all'|'favorites'|'recent'
export const emptyLibraryCollections=():LibraryCollections=>({favorites:[],recent:[]})
const validId=(id:unknown):id is string=>typeof id==='string'&&id.trim().length>0&&id.length<=160
export function toggleFavorite(collections:LibraryCollections,id:string):LibraryCollections{
    if(!validId(id))return collections
    const favorites=collections.favorites.includes(id)?collections.favorites.filter(item=>item!==id):[...collections.favorites,id].slice(-200)
    return {...collections,favorites}
}
export function openLibraryTitle(collections:LibraryCollections,id:string):LibraryCollections{
    if(!validId(id))return collections
    return {...collections,recent:[id,...collections.recent.filter(item=>item!==id)].slice(0,30)}
}
// Collections contain identifiers only. Always intersect with the current
// catalog and its search/entitlement filters before rendering or launching.
export function libraryView(titles:CloudTitle[],collections:LibraryCollections,view:LibraryView):CloudTitle[]{
    if(view==='favorites'){
        const ids=new Set(collections.favorites)
        return titles.filter(title=>ids.has(title.id))
    }
    if(view==='recent'){
        const byId=new Map(titles.map(title=>[title.id,title]))
        return collections.recent.flatMap(id=>{const title=byId.get(id);return title?[title]:[]})
    }
    return titles
}
