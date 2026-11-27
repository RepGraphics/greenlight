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
