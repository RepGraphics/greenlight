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

import { screenshotFilename } from '../../renderer/lib/streamcapture'
test('screenshot filenames use portable UTC timestamps',()=>{assert.equal(screenshotFilename(new Date('2026-11-24T14:00:01.123Z')),'greenlight-2026-11-24T14-00-01-123Z.png')})

import { recordingFilename, recordingLimitBytes, recordingLimitMs } from '../../renderer/lib/streamrecording'
test('recording uses bounded clip targets and portable filenames',()=>{assert.equal(recordingFilename(new Date('2026-11-24T14:00:01.123Z')),'greenlight-clip-2026-11-24T14-00-01-123Z.webm');assert.equal(recordingLimitBytes,134217728);assert.equal(recordingLimitMs,300000)})

import { requestedDisplay } from '../../main/helpers/streamresolution'
test('requested display sizes accept only supported presets',()=>{assert.deepEqual(requestedDisplay(720),{widthInPixels:1280,heightInPixels:720});assert.deepEqual(requestedDisplay(1080),{widthInPixels:1920,heightInPixels:1080});assert.deepEqual(requestedDisplay(2160),requestedDisplay(1080));assert.deepEqual(requestedDisplay('720'),requestedDisplay(1080))})

import { recoveryDelay } from '../../renderer/lib/sessionrecovery'
test('automatic recovery is opt-in, limited to established Remote Play and bounded',()=>{assert.equal(recoveryDelay(true,false,true,0),3000);assert.equal(recoveryDelay(true,false,true,1),8000);assert.equal(recoveryDelay(true,false,true,2),null);assert.equal(recoveryDelay(true,true,true,0),null);assert.equal(recoveryDelay(false,false,true,0),null);assert.equal(recoveryDelay(true,false,false,0),null)})

import { MediaStallMonitor } from '../../../player/src/client/lib/mediastall'
test('media stalls require established inbound traffic and sustained inactivity',()=>{const monitor=new MediaStallMonitor();assert.equal(monitor.sample(0,[{id:'v',bytes:10}],true),false);for(let t=1000;t<15000;t+=1000)assert.equal(monitor.sample(t,[{id:'v',bytes:10}],true),false);assert.equal(monitor.sample(15000,[{id:'v',bytes:10}],true),true);assert.equal(monitor.sample(16000,[{id:'v',bytes:11}],true),false);assert.equal(monitor.sample(17000,[],false),false)})

import { statsExpired } from '../../../player/src/client/lib/statsfreshness'
test('stale native reports are detected independently of packet counters',()=>{assert.equal(statsExpired(16000,1000,0),true);assert.equal(statsExpired(15999,1000,0),false);assert.equal(statsExpired(20000,1000,19000),false);assert.equal(statsExpired(15000,0,0),true)})


test('per-title and console resolution overrides accept supported display sizes only',()=>{
    assert.equal(readGameProfiles([{titleId:'game',resolution:720}])[0].resolution,720)
    assert.equal(readGameProfiles([{titleId:'game',resolution:1080}])[0].resolution,1080)
    assert.equal(readGameProfiles([{titleId:'game',resolution:1440}])[0].resolution,null)
    assert.equal(readConsoleProfiles([{consoleId:'console',resolution:720}])[0].resolution,720)
    assert.equal(readConsoleProfiles([{consoleId:'console',resolution:'720'}])[0].resolution,null)
    assert.equal(readConsoleProfiles([{consoleId:'console'}])[0].resolution,null)
})

import { validateShortcuts, assignShortcut, shortcutAction } from '../../renderer/lib/streamshortcuts'
test('stream shortcuts reject unsafe keys and resolve duplicates',()=>{assert.equal(validateShortcuts({controls:'Escape'}).controls,'F8');assert.equal(assignShortcut({},'mute','F8').controls,'');assert.equal(assignShortcut({},'mute','F8').mute,'F8');assert.equal(validateShortcuts({controls:'F8',mute:'F8'}).mute,'');const event={key:'F8',repeat:false,altKey:false,ctrlKey:false,metaKey:false,shiftKey:false,editable:false};assert.equal(shortcutAction({},event),'controls');assert.equal(shortcutAction({}, {...event,editable:true}),undefined);assert.equal(shortcutAction({}, {...event,repeat:true}),undefined)})

import { canStoreCapture,captureLimitBytes,captureLimitCount } from '../../renderer/lib/capturelibrary'
test('capture library enforces byte and count limits without automatic deletion',()=>{assert.equal(canStoreCapture(1,0,0),true);assert.equal(canStoreCapture(1,captureLimitCount,0),false);assert.equal(canStoreCapture(1,0,captureLimitBytes),false);assert.equal(canStoreCapture(captureLimitBytes,0,0),true);assert.equal(canStoreCapture(-1,0,0),false);assert.equal(canStoreCapture(1,0,NaN),false)})

import { validReplaySegment,replayMaxBytes } from '../../renderer/lib/instantreplay'
test('instant replay only accepts recent complete bounded WebM segments',()=>{const blob=new Blob(['video'],{type:'video/webm'});assert.equal(validReplaySegment({blob,startedAt:1000,endedAt:31000},32000),true);assert.equal(validReplaySegment({blob,startedAt:1000,endedAt:31000},100000),false);assert.equal(validReplaySegment({blob:new Blob([],{type:'video/webm'}),startedAt:1000,endedAt:31000},32000),false);assert.equal(validReplaySegment({blob,startedAt:32000,endedAt:31000},32000),false);assert.equal(replayMaxBytes,32*1024*1024)})

import { reconcileSlots } from '../../../player/src/client/lib/input/slots'
test('controller slot assignment is unique, bounded and stable on hotplug',()=>{const first=reconcileSlots([],[7,2,4,9,12]);assert.deepEqual(first.map(s=>s.physicalId),[2,4,7,9]);const second=reconcileSlots(first,[4,7,9,12]);assert.deepEqual(second.map(s=>s.physicalId),[12,4,7,9]);assert.deepEqual(reconcileSlots([],[],true),[{slot:0,physicalId:null}]);assert.deepEqual(reconcileSlots([],[2,2,-1,NaN]),[{slot:0,physicalId:2}])})

import { recoveryBitrate } from '../../renderer/lib/bitrateadvisor'
test('adaptive recovery only lowers caps on sustained fresh congestion evidence',()=>{const samples=Array.from({length:20},(_,i)=>({elapsedSeconds:i,width:1920,height:1080,fps:60,bitrate:20,jitter:40,loss:0,rtt:200,statsFresh:true}));assert.equal(recoveryBitrate(samples,20480,'transport',true),10240);assert.equal(recoveryBitrate(samples,20480,'stats',true),null);assert.equal(recoveryBitrate(samples,20480,'transport',false),null);assert.equal(recoveryBitrate(samples.map(s=>({...s,rtt:5,jitter:1})),20480,'media',true),null);assert.equal(recoveryBitrate(samples.map(s=>({...s,statsFresh:false})),20480,'media',true),null)})

import { replayDuration } from '../../renderer/lib/instantreplay'
test('replay duration is bounded and replay shortcuts are opt-in',()=>{assert.equal(replayDuration(15),15);assert.equal(replayDuration(60),60);assert.equal(replayDuration(120),30);assert.equal(replayDuration('60'),30);assert.equal(validateShortcuts({}).replay,'');assert.equal(assignShortcut({},'replay','F8').controls,'');assert.equal(portableSettings({v3_replay_seconds:60}).v3_replay_seconds,60)})

import { parseDiagnostics } from '../../renderer/lib/diagnosticsimport'
test('diagnostic import recalculates summaries and restricts untrusted data',()=>{const result=parseDiagnostics(JSON.stringify({schema:4,engine:'v3',type:'home',renderer:'video',state:'Error',failureReason:'stats',summary:{averageFps:999},samples:[{elapsedSeconds:2,width:1920,height:1080,fps:60,statsFresh:false,token:'secret'},{elapsedSeconds:1,width:1920,height:1080,fps:59},{elapsedSeconds:-1}],previousAttempts:[{state:'Connected',samples:[]}]}));assert.equal(result.attempts.length,2);assert.equal(result.attempts[1].reason,'stats');assert.equal(result.attempts[1].samples.length,2);assert.equal(result.attempts[1].samples[0].fps,59);assert.equal('token' in result.attempts[1].samples[1],false);assert.throws(()=>parseDiagnostics('{}'))})

import { configureClassicConsoleController } from '../../renderer/lib/classicconsolecontroller'
test('classic console controller mode suppresses input but preserves handshake and frame acknowledgements',()=>{let calls=0;const count=()=>{calls++};const control={start:()=>{control.sendGamepadAdded();count()},sendGamepadAdded:count,sendGamepadRemoved:count};const input={start:count,addProcessedFrame:count,queueGamepadState:count,pressButton:count,onPointerClick:count};const player={_inputDriver:{start:count,run:count},_keyboardDriver:{start:count},getChannelProcessor:(name:string)=>name==='control'?control:input};configureClassicConsoleController(player);player._inputDriver.start();player._inputDriver.run();player._keyboardDriver.start();control.sendGamepadAdded();control.sendGamepadRemoved();input.queueGamepadState();input.pressButton();input.onPointerClick();assert.equal(calls,0);control.start();input.start();input.addProcessedFrame();assert.equal(calls,3)})
