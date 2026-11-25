import {test} from 'node:test'
import assert from 'node:assert/strict'
import {filterCloudCatalog} from '../../main/helpers/cloudcatalog'
const catalog=[
    {titleId:'z',hasEntitlement:true,catalogDetails:{ProductTitle:'Zelda 10',PublisherName:'Example Studio'}},
    {titleId:'a',hasEntitlement:true,catalogDetails:{ProductTitle:'Álpha 2',PublisherName:'Example Studio'}},
    {titleId:'a',hasEntitlement:true,catalogDetails:{ProductTitle:'Duplicate'}},
    {titleId:'paid',hasEntitlement:false,catalogDetails:{ProductTitle:'Alpha 10'}},
    {titleId:'unknown',hasEntitlement:true},
    null,{titleId:42,hasEntitlement:true}
]
test('catalog search matches accented titles and publisher terms',()=>{
    assert.deepEqual(filterCloudCatalog(catalog,{name:'alpha example'}),['a'])
    assert.deepEqual(filterCloudCatalog(catalog,{name:'EXAMPLE'}),['z','a'])
})
test('catalog sorting puts missing metadata last in either direction',()=>{
    assert.deepEqual(filterCloudCatalog(catalog,{sort:'az'}),['a','z','unknown'])
    assert.deepEqual(filterCloudCatalog(catalog,{sort:'za'}),['z','a','unknown'])
    assert.deepEqual(filterCloudCatalog(catalog,{sort:'az',onlyEntitled:false}),['a','paid','z','unknown'])
})
test('catalog safely defaults to entitled titles and deduplicates malformed entries',()=>{
    assert.deepEqual(filterCloudCatalog(catalog,null),['z','a','unknown'])
    assert.deepEqual(filterCloudCatalog(catalog,{name:42,onlyEntitled:'false',sort:'unknown'}),['z','a','unknown'])
})
