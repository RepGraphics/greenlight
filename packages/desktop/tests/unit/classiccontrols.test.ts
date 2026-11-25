import {test} from 'node:test'
import assert from 'node:assert/strict'
import {classicControlsVisible,classicControlsIdleMs} from '../../renderer/lib/classiccontrols'
const idle={connected:true,pinned:false,hovered:false,focused:false,dialog:false,idleMs:classicControlsIdleMs}
test('Classic controls hide only after the full idle interval on a connected stream',()=>{
    assert.equal(classicControlsVisible({...idle,idleMs:0}),true)
    assert.equal(classicControlsVisible({...idle,idleMs:classicControlsIdleMs-1}),true)
    assert.equal(classicControlsVisible(idle),false)
    assert.equal(classicControlsVisible({...idle,idleMs:99999}),false)
})
test('Classic toolbar remains reachable during loading, pinning, hover, focus and dialogs',()=>{
    for(const state of [{connected:false},{pinned:true},{hovered:true},{focused:true},{dialog:true}]){
        assert.equal(classicControlsVisible({...idle,...state}),true)
    }
})
test('new pointer activity and discontinuous clocks reveal the Classic toolbar',()=>{
    for(const idleMs of [0,-1,NaN,Infinity])assert.equal(classicControlsVisible({...idle,idleMs}),true)
})
