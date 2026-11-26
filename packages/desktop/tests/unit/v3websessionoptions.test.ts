import {test} from 'node:test'
import assert from 'node:assert/strict'
import {webSessionInputOptions,webKeyboardMapping} from '../../../desktop-v3/renderer/utils/sessionoptions'

test('Remote Play console-paired mode disables every client input option',()=>{
    for(const mode of ['off','controller','direct'] as const){
        assert.deepEqual(webSessionInputOptions('home',true,true,mode,true),{consoleController:true,autoGamepad:false,multiController:false,touchControls:false,directTouch:false,keyboardMapping:undefined})
    }
})
test('Cloud Gaming never uses console-paired mode even with stale settings',()=>{
    assert.deepEqual(webSessionInputOptions('cloud',true,true,'controller'),{consoleController:false,autoGamepad:true,multiController:true,touchControls:true,directTouch:false,keyboardMapping:undefined})
})
test('local controller mode can opt out of multiple controller slots',()=>{
    assert.deepEqual(webSessionInputOptions('home',false,false,'controller'),{consoleController:false,autoGamepad:true,multiController:false,touchControls:true,directTouch:false,keyboardMapping:undefined})
})
test('default local mode does not register an on-screen controller until requested',()=>{
    assert.deepEqual(webSessionInputOptions('home',false,true,'off'),{consoleController:false,autoGamepad:true,multiController:true,touchControls:false,directTouch:false,keyboardMapping:undefined})
})
test('direct touchscreen and virtual controller modes are mutually exclusive for both targets',()=>{
    for(const type of ['home','cloud'] as const){
        const direct=webSessionInputOptions(type,false,true,'direct')
        assert.equal(direct.directTouch,true);assert.equal(direct.touchControls,false)
        const controller=webSessionInputOptions(type,false,true,'controller')
        assert.equal(controller.directTouch,false);assert.equal(controller.touchControls,true)
    }
})
test('keyboard emulation uses a stable key-to-button mapping and can be disabled',()=>{
    const first=webSessionInputOptions('cloud',false,true,'off',true)
    const next=webSessionInputOptions('cloud',false,true,'controller',true)
    assert.equal(first.keyboardMapping,webKeyboardMapping)
    assert.equal(first.keyboardMapping,next.keyboardMapping)
    assert.equal(first.keyboardMapping?.Enter,'A')
    assert.equal(first.keyboardMapping?.ArrowLeft,'DPadLeft')
    assert.equal(first.keyboardMapping?.n,'Nexus')
    assert.equal(Object.keys(webKeyboardMapping).length,17)
    assert.equal(webSessionInputOptions('cloud',false,true,'off',false).keyboardMapping,undefined)
})
