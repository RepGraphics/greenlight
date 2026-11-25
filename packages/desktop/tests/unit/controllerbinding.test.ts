import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ButtonCapture,captureButtonMapping} from '../../renderer/lib/controllerbinding'
test('held buttons cannot bind until released and pressed again',()=>{
    const capture=new ButtonCapture([1,0])
    assert.deepEqual(capture.sample([1,0]),{kind:'waiting'})
    assert.deepEqual(capture.sample([.2,0]),{kind:'waiting'})
    assert.deepEqual(capture.sample([.9,0]),{kind:'captured',index:0})
})
test('analog trigger noise remains below activation threshold',()=>{
    const capture=new ButtonCapture([0,0])
    for(const n of [.01,.3,.7])assert.deepEqual(capture.sample([0,n]),{kind:'waiting'})
    assert.deepEqual(capture.sample([0,.8]),{kind:'captured',index:1})
})
test('simultaneous presses require complete release',()=>{
    const capture=new ButtonCapture([0,0])
    assert.deepEqual(capture.sample([1,1]),{kind:'ambiguous'})
    assert.deepEqual(capture.sample([1,0]),{kind:'ambiguous'})
    assert.deepEqual(capture.sample([0,0]),{kind:'waiting'})
    assert.deepEqual(capture.sample([0,1]),{kind:'captured',index:1})
})
test('binding accepts supported indices and known targets only',()=>{
    const prior={A:'5',B:'4'}
    assert.equal(captureButtonMapping(prior,'B',63).B,'63')
    assert.equal(captureButtonMapping(prior,'B',64).B,'4')
    assert.equal(captureButtonMapping(prior,'B',NaN).B,'4')
    assert.equal(captureButtonMapping(prior,'__proto__',2).A,'5')
    assert.equal(prior.B,'4')
    assert.deepEqual(new ButtonCapture([]).sample([...Array(64).fill(0),1]),{kind:'waiting'})
})
