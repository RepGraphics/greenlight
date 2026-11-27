import {test} from 'node:test'
import assert from 'node:assert/strict'
import {GpuFrameWatchdog} from '../../../player/src/client/lib/render/gpuframewatchdog'

test('GPU startup gets a bounded visible connected initialization window',()=>{
    const monitor=new GpuFrameWatchdog(100)
    assert.equal(monitor.stalled(100,true,true),false)
    assert.equal(monitor.stalled(10099,true,true),false)
    assert.equal(monitor.stalled(10100,true,true),true)
})
test('previous successful frames do not conceal a later renderer freeze',()=>{
    const monitor=new GpuFrameWatchdog(0)
    monitor.stalled(0,true,true)
    monitor.rendered(2000)
    monitor.rendered(4000)
    assert.equal(monitor.stalled(8999,true,true),false)
    assert.equal(monitor.stalled(9000,true,true),true)
    monitor.rendered(9001)
    assert.equal(monitor.stalled(9002,true,true),false)
})
test('backgrounded or disconnected renderers receive a fresh visible grace period',()=>{
    for(const [visible,connected] of [[false,true],[true,false]]){
        const monitor=new GpuFrameWatchdog(0)
        monitor.rendered(100)
        assert.equal(monitor.stalled(200,true,true),false)
        assert.equal(monitor.stalled(1000,visible,connected),false)
        assert.equal(monitor.stalled(60000,true,true),false)
        assert.equal(monitor.stalled(64999,true,true),false)
        assert.equal(monitor.stalled(65000,true,true),true)
    }
})
test('invalid or older frame times cannot falsely refresh the watchdog',()=>{
    const monitor=new GpuFrameWatchdog(100)
    monitor.stalled(100,true,true)
    monitor.rendered(1000)
    for(const time of [NaN,Infinity,-1,500])monitor.rendered(time)
    assert.equal(monitor.stalled(6000,true,true),true)
    assert.equal(monitor.stalled(NaN,true,true),false)
    assert.equal(monitor.stalled(10000,true,true),false)
})
