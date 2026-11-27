import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyWebSetupPresets,snapshotWebSetup,rememberWebSetup,forgetWebSetup} from '../../../desktop-v3/renderer/utils/websetuppresets'

test('default setup remains compatible with existing streaming defaults',()=>{
    const value=snapshotWebSetup('home',null)
    assert.equal(value.resolution,1080);assert.equal(value.bitrate,0)
    assert.equal(value.profile.v3_deadzone,.08);assert.equal(value.volume,1)
    assert.equal(value.touch,'off');assert.equal(value.keyboard,false)
    assert.equal(value.consolePaired,false);assert.equal(value.showStats,true)
})
test('setup presets keep Remote Play and Cloud Gaming independent',()=>{
    const empty=emptyWebSetupPresets()
    const home=rememberWebSetup(empty,'home',{resolution:720,bitrate:4096,consolePaired:true})
    const both=rememberWebSetup(home,'cloud',{resolution:1080,bitrate:8192,touch:'controller'})
    assert.deepEqual(empty,{home:null,cloud:null})
    assert.equal(both.home?.bitrate,4096);assert.equal(both.cloud?.bitrate,8192)
    assert.equal(both.cloud?.touch,'controller')
    assert.equal(forgetWebSetup(both,'home').home,null)
    assert.equal(forgetWebSetup(both,'home').cloud,both.cloud)
})
test('console pairing excludes local input only for Remote Play',()=>{
    const input={consolePaired:true,touch:'direct',keyboard:true}
    const home=snapshotWebSetup('home',input),cloud=snapshotWebSetup('cloud',input)
    assert.equal(home.touch,'off');assert.equal(home.keyboard,false)
    assert.equal(cloud.consolePaired,false);assert.equal(cloud.touch,'direct');assert.equal(cloud.keyboard,true)
})
test('snapshot validates bounds, types and ignores private fields',()=>{
    const value=snapshotWebSetup('home',{resolution:4,bitrate:1025,volume:999,touch:'invalid',profile:{name:'secret',v3_deadzone:99,v3_button_mapping:{A:'2'}},token:'secret',mic:true,muted:true,endpoint:'secret'})
    assert.equal(value.resolution,1080);assert.equal(value.bitrate,0)
    assert.equal(value.volume,1);assert.equal(value.touch,'off')
    assert.equal(value.profile.v3_deadzone,.5)
    assert.equal(value.profile.v3_button_mapping.A,'2')
    assert.equal(JSON.stringify(value).includes('secret'),false)
    assert.equal('mic' in value,false);assert.equal('muted' in value,false)
})
test('saved mappings and filters are snapshots rather than mutable references',()=>{
    const input={profile:{v3_button_mapping:{A:'3'}},filters:{brightness:110}}
    const value=snapshotWebSetup('cloud',input)
    input.profile.v3_button_mapping.A='1';input.filters.brightness=90
    assert.equal(value.profile.v3_button_mapping.A,'3')
    assert.equal(value.filters.brightness,110)
})
