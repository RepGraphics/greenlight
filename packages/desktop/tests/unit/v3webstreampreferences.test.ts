import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultStreamPreferences,normalizeStreamPreferences,preferredControllerProfile,preferredStreamQuality} from '../../../desktop-v3/renderer/utils/streampreferences'

test('stream preferences preserve valid settings and default missing, invalid or unrelated fields',()=>{
    assert.deepEqual(normalizeStreamPreferences(null),defaultStreamPreferences)
    assert.deepEqual(normalizeStreamPreferences({
        resolution:720,bitrate:4096,showStats:false,keyboard:true,preset:'southpaw',deadzone:0,token:'ignored',
    }),{...defaultStreamPreferences,resolution:720,bitrate:4096,showStats:false,keyboard:true,preset:'southpaw',deadzone:0})
    assert.deepEqual(normalizeStreamPreferences({
        resolution:'720',bitrate:4000,showStats:'false',multipleControllers:2,vibration:null,preset:'__proto__',deadzone:2,
    }),defaultStreamPreferences)
})

test('new preferences round-trip, apply per-mode quality and preserve explicit controller overrides',()=>{
    const saved=normalizeStreamPreferences({
        resolution:720,bitrate:4096,remoteResolution:1080,remoteBitrate:0,gameLanguage:'en-GB',
        volume:.45,muted:true,videoFilters:{contrast:115},touch:'controller',consolePaired:true,
        preset:'southpaw',invertY:true,swapSticks:false,buttonMapping:{A:'9',B:'99'},
        clipSeconds:180,clipBitrate:6000000,replaySeconds:15,captureAudio:false,libraryLayout:'list',showUnavailable:true,
    })
    assert.deepEqual(normalizeStreamPreferences(JSON.parse(JSON.stringify(saved))),saved)
    assert.deepEqual(preferredStreamQuality(saved,'cloud'),{resolution:720,bitrate:4096})
    assert.deepEqual(preferredStreamQuality(saved,'home'),{resolution:1080,bitrate:0})
    const profile=preferredControllerProfile(saved)
    assert.equal(profile.v3_swap_sticks,false)
    assert.equal(profile.v3_invert_y,true)
    assert.equal(profile.v3_button_mapping.A,'9')
    assert.equal(profile.v3_button_mapping.B,'1')
    assert.equal(saved.videoFilters.contrast,115)
    assert.equal(saved.captureAudio,false)
    assert.equal(normalizeStreamPreferences({gameLanguage:'arbitrary',volume:4,touch:'bogus',clipSeconds:600,replaySeconds:40}).gameLanguage,'')
})
