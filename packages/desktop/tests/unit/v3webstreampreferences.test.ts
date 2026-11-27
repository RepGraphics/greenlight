import {test} from 'node:test'
import assert from 'node:assert/strict'
import {defaultStreamPreferences,normalizeStreamPreferences} from '../../../desktop-v3/renderer/utils/streampreferences'

test('stream preferences preserve valid settings and default missing, invalid or unrelated fields',()=>{
    assert.deepEqual(normalizeStreamPreferences(null),defaultStreamPreferences)
    assert.deepEqual(normalizeStreamPreferences({
        resolution:720,bitrate:4096,showStats:false,keyboard:true,preset:'southpaw',deadzone:0,token:'ignored',
    }),{...defaultStreamPreferences,resolution:720,bitrate:4096,showStats:false,keyboard:true,preset:'southpaw',deadzone:0})
    assert.deepEqual(normalizeStreamPreferences({
        resolution:'720',bitrate:4000,showStats:'false',multipleControllers:2,vibration:null,preset:'__proto__',deadzone:2,
    }),defaultStreamPreferences)
})
