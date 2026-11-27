import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeCloudTitles,catalogBatches,hydrateCloudTitles,filterCloudTitles} from '../../../desktop-v3/renderer/utils/cloudlibrary'
const row=(titleId:string,productId:string,hasEntitlement=false)=>({titleId,details:{productId,hasEntitlement}})
test('cloud catalog distinguishes empty from malformed responses and drops duplicate identifiers',()=>{
    const titles=normalizeCloudTitles({data:{results:[row('one','A',true),row('one','B'),{titleId:'two',details:{isFreeInStore:true}},row('three','C'),null,{titleId:''}]}})
    assert.deepEqual(titles.map(title=>[title.id,title.entitled]),[['one',true],['two',true],['three',false]])
    assert.deepEqual(normalizeCloudTitles({data:{results:[]}}),[])
    for(const value of [null,{}, {data:{results:{}}}])assert.throws(()=>normalizeCloudTitles(value))
})
test('metadata requests deduplicate product IDs and use batches of at most 100',()=>{
    const titles=normalizeCloudTitles({data:{results:[...Array.from({length:201},(_,i)=>row('title-'+i,'product-'+i)),row('duplicate','product-0'),row('empty','')]}})
    const batches=catalogBatches(titles)
    assert.deepEqual(batches.map(batch=>batch.length),[100,100,1])
    assert.equal(new Set(batches.flat()).size,201)
})
test('metadata hydration preserves entitlement and never introduces undiscovered titles',()=>{
    const titles=normalizeCloudTitles({data:{results:[row('one','A',true),row('two','B')]}})
    const hydrated=hydrateCloudTitles(titles,{data:{Products:{A:{ProductTitle:'Adventure',PublisherName:'Studio',hasEntitlement:false},C:{ProductTitle:'Unknown'}}}})
    assert.deepEqual(hydrated,[{...titles[0],name:'Adventure',publisher:'Studio'},titles[1]])
    assert.equal(titles[0].name,'one')
    assert.throws(()=>hydrateCloudTitles(titles,{data:{Products:[]}}))
})
test('only known Xbox artwork hosts are rendered and rejected art leaves the title playable',()=>{
    const titles=normalizeCloudTitles({data:{results:[row('one','A',true)]}})
    const [game]=hydrateCloudTitles(titles,{data:{Products:{A:{
        ProductTitle:'Adventure',
        ProductDescriptionShort:'A short description',
        Image_Tile:{URL:'https://store-images.s-microsoft.com.example.test/tile'},
        Image_Poster:{URL:'//store-images.s-microsoft.com/poster'},
        Image_Hero:{URL:'http://store-images.s-microsoft.com/hero'},
    }}}})
    assert.equal(game.cover,'https://store-images.s-microsoft.com/poster')
    assert.equal(game.hero,undefined)
    assert.equal(game.description,'A short description')
    assert.equal(game.entitled,true)
})
test('search and sorting respect entitlement and do not mutate the source',()=>{
    const titles=normalizeCloudTitles({data:{results:[row('b','B',true),row('a','A'),row('c','C',true)]}})
    const hydrated=hydrateCloudTitles(titles,{data:{Products:{A:{ProductTitle:'Alpha',PublisherName:'Studio'},B:{ProductTitle:'Beta',PublisherName:'Studio'},C:{ProductTitle:'Charlie'}}}})
    assert.deepEqual(filterCloudTitles(hydrated,' studio ',true,'az').map(title=>title.id),['b'])
    assert.deepEqual(filterCloudTitles(hydrated,'',false,'za').map(title=>title.id),['c','b','a'])
    assert.deepEqual(hydrated.map(title=>title.id),['b','a','c'])
})
