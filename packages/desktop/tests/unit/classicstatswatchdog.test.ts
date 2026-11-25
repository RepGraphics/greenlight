import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ClassicStatsWatchdog,classicStatsStallSeconds} from '../../renderer/lib/classicstatswatchdog'

test('Classic ignores initial missing stats until real inbound progress has been observed',()=>{
    const watch=new ClassicStatsWatchdog()
    for(let n=0;n<60;n++)assert.equal(watch.observe(n,false,true),false)
    assert.equal(watch.observe(60,true,true),false)
    for(let n=61;n<61+classicStatsStallSeconds;n++)assert.equal(watch.observe(n,false,true),false)
    assert.equal(watch.observe(61+classicStatsStallSeconds,false,true),true)
    assert.equal(watch.observe(62+classicStatsStallSeconds,false,true),false)
})
test('a fresh sample resets a pending Classic stats stall',()=>{
    const watch=new ClassicStatsWatchdog()
    watch.observe(0,true,true)
    for(let n=1;n<15;n++)assert.equal(watch.observe(n,false,true),false)
    watch.observe(15,true,true)
    for(let n=16;n<31;n++)assert.equal(watch.observe(n,false,true),false)
    assert.equal(watch.observe(31,false,true),true)
})
test('background windows, long polling gaps and clock resets require new fresh evidence',()=>{
    for(const [next,visible,fresh] of [[2,false,false],[20,true,false],[0,true,false],[2,true,undefined],[NaN,true,false]] as const){
        const watch=new ClassicStatsWatchdog()
        watch.observe(0,true,true);watch.observe(1,false,true)
        assert.equal(watch.observe(next,fresh,visible),false)
        for(let n=21;n<50;n++)assert.equal(watch.observe(n,false,true),false)
        watch.observe(50,true,true)
        for(let n=51;n<66;n++)assert.equal(watch.observe(n,false,true),false)
        assert.equal(watch.observe(66,false,true),true)
    }
})
test('a new Classic connection can explicitly reset the watchdog',()=>{
    const watch=new ClassicStatsWatchdog()
    watch.observe(0,true,true)
    for(let n=1;n<=16;n++)watch.observe(n,false,true)
    watch.reset()
    for(let n=0;n<30;n++)assert.equal(watch.observe(n,false,true),false)
    watch.observe(30,true,true)
    for(let n=31;n<46;n++)assert.equal(watch.observe(n,false,true),false)
    assert.equal(watch.observe(46,false,true),true)
})
