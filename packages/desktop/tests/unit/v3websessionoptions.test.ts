import {test} from 'node:test'
import assert from 'node:assert/strict'
import {webSessionInputOptions} from '../../../desktop-v3/renderer/utils/sessionoptions'

test('Remote Play console-paired mode disables every client gamepad input option',()=>{
    assert.deepEqual(webSessionInputOptions('home',true,true,true),{consoleController:true,autoGamepad:false,multiController:false,touchControls:false})
})
test('Cloud Gaming never uses console-paired mode even with stale settings',()=>{
    assert.deepEqual(webSessionInputOptions('cloud',true,true,true),{consoleController:false,autoGamepad:true,multiController:true,touchControls:true})
})
test('local controller mode can opt out of multiple controller slots',()=>{
    assert.deepEqual(webSessionInputOptions('home',false,false,true),{consoleController:false,autoGamepad:true,multiController:false,touchControls:true})
})
test('default local mode does not register an on-screen controller until requested',()=>{
    assert.deepEqual(webSessionInputOptions('home',false,true,false),{consoleController:false,autoGamepad:true,multiController:true,touchControls:false})
})
