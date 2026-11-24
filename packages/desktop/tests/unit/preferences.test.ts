import { test } from 'node:test'
import assert from 'node:assert/strict'
import { portableSettings, parseBackup } from '../../renderer/lib/settingsbackup'
import { readProfiles, snapshotProfile, controllerPresets } from '../../renderer/lib/controllerprofiles'
import { readGameProfiles } from '../../renderer/lib/gameprofiles'
import { readConsoleProfiles } from '../../renderer/lib/consoleprofiles'
import { validateButtonMapping } from '../../../player/src/client/lib/input/mapping'
import { sanitizeSample, summarizeDiagnostics } from '../../renderer/lib/streamdiagnostics'

test('mapping preserves standard actions and rejects invalid indices', () => {
    const mapping = validateButtonMapping({ A:'63', B:'64', X:'-1', Y:2, unknown:'4' })
    assert.equal(mapping.A,'63')
    assert.equal(mapping.B,'1')
    assert.equal(mapping.X,'2')
    assert.equal(mapping.Y,'3')
    assert.equal(Object.keys(mapping).length,17)
    assert.equal(Object.hasOwn(mapping,'unknown'),false)
})
test('controller profiles clamp invalid values and support presets', () => {
    const profile = snapshotProfile('  test  ', {v3_deadzone:1,v3_mouse_sensitivity:0,v3_invert_y:true})
    assert.equal(profile.name,'test')
    assert.equal(profile.v3_deadzone,0.5)
    assert.equal(profile.v3_mouse_sensitivity,0.25)
    assert.equal(profile.v3_invert_y,true)
    assert.equal(controllerPresets.southpaw.v3_swap_sticks,true)
    assert.equal(readProfiles(Array.from({length:30},(_,i)=>({name:String(i)}))).length,20)
})
test('game and console profiles validate identifiers and overrides', () => {
    assert.deepEqual(readGameProfiles([{titleId:'../bad'}, {titleId:'valid',bitrate:50000,renderer:'invalid'}]).map(p=>[p.titleId,p.bitrate,p.renderer]),[['valid',40960,'default']])
    assert.equal(readConsoleProfiles([{consoleId:'console-1',bitrate:0}])[0].bitrate,0)
    assert.equal(readConsoleProfiles([{consoleId:''}]).length,0)
})
test('settings backups exclude sensitive and unknown fields', () => {
    const parsed = portableSettings(JSON.parse('{"xhome_bitrate":50000,"webui_port":9000,"webui_autostart":true,"token":"secret","__proto__":{"polluted":true},"input_mousekeyboard_config":{"a":"A","constructor":"B","bad":"unknown"}}'))
    assert.equal(parsed.xhome_bitrate,40960)
    assert.equal(Object.hasOwn(parsed,'webui_port'),false)
    assert.equal(Object.hasOwn(parsed,'token'),false)
    assert.deepEqual(parsed.input_mousekeyboard_config,{a:'A'})
    assert.equal(Object.hasOwn({},'polluted'),false)
})
test('backup parser rejects corrupt, unsupported and empty backups', () => {
    for (const text of ['{','{}','{"format":"greenlight-settings","version":2,"settings":{"audio_enabled":false}}','{"format":"greenlight-settings","version":1,"settings":{"token":"secret"}}']) assert.throws(()=>parseBackup(text))
    assert.deepEqual(parseBackup('{"format":"greenlight-settings","version":1,"settings":{"audio_enabled":false,"xcloud_bitrate":0}}'),{audio_enabled:false,xcloud_bitrate:0})
})
test('diagnostics exclude arbitrary properties and sanitize nonfinite values', () => {
    const sample = sanitizeSample({width:1920,height:1080,fps:60,bitrate:NaN,jitter:-1,loss:3,rtt:Infinity},2)
    assert.equal(sample.bitrate,0)
    assert.equal(sample.jitter,0)
    assert.equal(sample.rtt,0)
    assert.equal(Object.keys(sample).length,8)
})
test('quality summary requires sufficient samples and uses p95 latency', () => {
    const make = (rtt:number) => Array.from({length:10},(_,i)=>sanitizeSample({width:1920,height:1080,fps:60,bitrate:10,jitter:5,loss:i,rtt},i))
    assert.equal(summarizeDiagnostics([]).quality,'insufficient')
    assert.equal(summarizeDiagnostics(make(20).slice(0,4)).quality,'insufficient')
    assert.equal(summarizeDiagnostics(make(20)).quality,'good')
    assert.equal(summarizeDiagnostics(make(100)).quality,'fair')
    assert.equal(summarizeDiagnostics(make(200)).quality,'poor')
    assert.equal(summarizeDiagnostics(make(20)).packetsLostDuringWindow,9)
})

import { makeSessionRecord } from '../../renderer/lib/sessionhistory'

test('session history records connected duration without target identifiers',()=>{
 const record=makeSessionRecord(1000,3000,63000,'home','ended',[])
 assert.equal(record.durationSeconds,60)
 assert.equal(record.quality,'insufficient')
 assert.equal(Object.keys(record).length,8)
 assert.equal(makeSessionRecord(1000,0,5000,'cloud','failed',[]).durationSeconds,0)
})

import { recommendDeadzone } from '../../renderer/lib/controllercalibration'
test('calibration recommends a bounded deadzone and rejects movement',()=>{assert.equal(recommendDeadzone(Array.from({length:60},()=>[0,0,0,0])),0.03);assert.equal(recommendDeadzone(Array.from({length:60},()=>[0.1,0,0,0])),0.12);assert.equal(recommendDeadzone(Array.from({length:60},()=>[0.7,0,0,0])),null);assert.equal(recommendDeadzone([[0,0,0,0]]),null)})

import { validateVideoFilters,videoFilterCss,sharpeningKernel } from '../../renderer/lib/videofilters'
test('video filters clamp imported preferences and generate safe CSS',()=>{assert.deepEqual(validateVideoFilters({brightness:999,contrast:-1,saturation:NaN}),{brightness:150,contrast:50,saturation:100,sharpening:0});assert.equal(videoFilterCss({saturation:0}),'brightness(100%) contrast(100%) saturate(0%)')})

import { recommendLowerBitrate } from '../../renderer/lib/bitrateadvisor'
test('bitrate advice requires sustained poor quality and reduces the existing cap',()=>{const samples=Array.from({length:20},(_,i)=>sanitizeSample({width:1920,height:1080,fps:60,bitrate:16,jitter:35,loss:i,rtt:200},i));assert.equal(recommendLowerBitrate(samples,20480),10240);assert.equal(recommendLowerBitrate(samples,4096),2048);assert.equal(recommendLowerBitrate(samples.slice(0,5),20480),null);assert.equal(recommendLowerBitrate(samples.map(s=>({...s,rtt:30,jitter:5})),20480),null)})

test('sharpening is opt-in, bounded and preserves constant image brightness',()=>{assert.equal(validateVideoFilters({}).sharpening,0);assert.equal(validateVideoFilters({sharpening:999}).sharpening,100);assert.equal(validateVideoFilters({sharpening:-1}).sharpening,0);assert.equal(sharpeningKernel(0),'0 0 0 0 1 0 0 0 0');assert.ok(Math.abs(sharpeningKernel(75).split(' ').map(Number).reduce((a,b)=>a+b,0)-1)<1e-9);assert.ok(videoFilterCss({sharpening:25}).endsWith('url(#gl-stream-sharpen)'))})
