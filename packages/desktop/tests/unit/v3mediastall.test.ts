import {test} from 'node:test'
import assert from 'node:assert/strict'
import {MediaStallMonitor} from '../../../player/src/client/lib/mediastall'
test('stalled video is detected after sustained lack of byte progress',()=>{
    const monitor=new MediaStallMonitor()
    assert.equal(monitor.sample(0,[{id:'video',bytes:100}],true),false)
    for(let now=1000;now<15000;now+=1000)assert.equal(monitor.sample(now,[{id:'video',bytes:100}],true),false)
    assert.equal(monitor.sample(15000,[{id:'video',bytes:100}],true),true)
    assert.equal(monitor.sample(16000,[{id:'video',bytes:200}],true),false)
})
test('backgrounding or a gap in samples resets the stall history',()=>{
    const monitor=new MediaStallMonitor()
    monitor.sample(0,[{id:'video',bytes:100}],true)
    assert.equal(monitor.sample(1000,[],false),false)
    assert.equal(monitor.sample(30000,[{id:'video',bytes:100}],true),false)
    assert.equal(monitor.sample(60000,[{id:'video',bytes:100}],true),false)
})

import {VisibleVideoWatchdog,statsExpired} from '../../../player/src/client/lib/statsfreshness'
test('initial video with zero bytes cannot remain stalled indefinitely',()=>{
    const monitor=new MediaStallMonitor()
    for(let now=0;now<20000;now+=1000)assert.equal(monitor.sample(now,[{id:'video',bytes:0}],true),false)
    assert.equal(monitor.sample(20000,[{id:'video',bytes:0}],true),true)
})
test('audio reports without fresh video fail as media rather than healthy playback',()=>{
    const watchdog=new VisibleVideoWatchdog()
    assert.equal(watchdog.sample(1000,true,true,1000,0,false),undefined)
    assert.equal(watchdog.sample(15999,true,true,15999,0,false),undefined)
    assert.equal(watchdog.sample(16000,true,true,16000,0,false),'media')
})
test('hidden and reconnecting sessions receive a fresh recovery grace period',()=>{
    const watchdog=new VisibleVideoWatchdog()
    assert.equal(watchdog.sample(1000,true,true,1000,1000,false),undefined)
    assert.equal(watchdog.sample(17000,true,false,1000,1000,true),undefined)
    assert.equal(watchdog.sample(50000,true,true,1000,1000,true),undefined)
    assert.equal(watchdog.sample(64000,false,true,1000,1000,true),undefined)
    assert.equal(watchdog.sample(80000,true,true,1000,1000,true),undefined)
    assert.equal(watchdog.sample(95000,true,true,1000,1000,true),'stats')
})

test('visibility events reset grace even when background interval callbacks were suspended',()=>{
    const watchdog=new VisibleVideoWatchdog()
    assert.equal(watchdog.sample(1000,true,true,1000,1000,false),undefined)
    watchdog.reset()
    assert.equal(watchdog.sample(120000,true,true,1000,1000,true),undefined)
    assert.equal(watchdog.sample(134999,true,true,1000,1000,true),undefined)
    assert.equal(watchdog.sample(135000,true,true,1000,1000,true),'stats')
})
test('invalid or future report timestamps cannot suppress the recovery deadline',()=>{
    for(const timestamp of [NaN,Infinity,-1,50000])assert.equal(statsExpired(16000,timestamp,1000),true)
    assert.equal(statsExpired(15999,0,1000),false)
    assert.equal(statsExpired(NaN,0,1000),false)
})
