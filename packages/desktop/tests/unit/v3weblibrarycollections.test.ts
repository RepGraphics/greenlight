import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyLibraryCollections,toggleFavorite,openLibraryTitle,libraryView} from '../../../desktop-v3/renderer/utils/librarycollections'
import {filterCloudTitles,type CloudTitle} from '../../../desktop-v3/renderer/utils/cloudlibrary'

const title=(id:string,entitled=true):CloudTitle=>({id,productId:'product-'+id,name:id,publisher:'Publisher',entitled})
test('favorites toggle immutably and reject invalid identifiers',()=>{
    const original=emptyLibraryCollections()
    const added=toggleFavorite(original,'Game A')
    assert.deepEqual(original.favorites,[])
    assert.deepEqual(added.favorites,['Game A'])
    assert.deepEqual(toggleFavorite(added,'Game A').favorites,[])
    assert.equal(toggleFavorite(original,''),original)
    assert.equal(toggleFavorite(original,' '.repeat(2)),original)
    assert.equal(toggleFavorite(original,'x'.repeat(161)),original)
})
test('favorites are bounded to 200 and older entries are evicted',()=>{
    let state=emptyLibraryCollections()
    for(let i=0;i<201;i++)state=toggleFavorite(state,'game-'+i)
    assert.equal(state.favorites.length,200)
    assert.equal(state.favorites[0],'game-1')
    assert.equal(state.favorites.at(-1),'game-200')
})
test('recent titles deduplicate and move to the front, capped at 30',()=>{
    let state=emptyLibraryCollections()
    for(let i=0;i<31;i++)state=openLibraryTitle(state,'game-'+i)
    assert.equal(state.recent.length,30)
    assert.equal(state.recent.includes('game-0'),false)
    state=openLibraryTitle(state,'game-5')
    assert.equal(state.recent[0],'game-5')
    assert.equal(state.recent.filter(id=>id==='game-5').length,1)
    assert.equal(openLibraryTitle(state,''),state)
})
test('collection views intersect with the current filtered catalog and retain recent order',()=>{
    const games=[title('Alpha'),title('Beta',false),title('Gamma')]
    let state=emptyLibraryCollections()
    for(const id of ['Alpha','Beta','missing','Gamma']){
        state=toggleFavorite(state,id)
        state=openLibraryTitle(state,id)
    }
    const available=filterCloudTitles(games,'',true,'az')
    assert.deepEqual(libraryView(available,state,'favorites').map(item=>item.id),['Alpha','Gamma'])
    assert.deepEqual(libraryView(available,state,'recent').map(item=>item.id),['Gamma','Alpha'])
    assert.deepEqual(libraryView(filterCloudTitles(games,'Alpha',true,'az'),state,'recent').map(item=>item.id),['Alpha'])
    assert.equal(libraryView(available,state,'all'),available)
})
test('new sign-in and clear operations can start with independent empty collections',()=>{
    const old=openLibraryTitle(toggleFavorite(emptyLibraryCollections(),'game'),'game')
    const next=emptyLibraryCollections()
    assert.deepEqual(next,{favorites:[],recent:[]})
    assert.notEqual(next.favorites,old.favorites)
    assert.deepEqual(libraryView([title('game')],next,'recent'),[])
})
