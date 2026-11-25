import {test} from 'node:test'
import assert from 'node:assert/strict'
import {KeyboardGamepadState,isEditableGamepadTarget} from '../../../player/src/client/lib/input/keyboardstate'
const mapping={A:'a',B:'b',LeftTrigger:'-',Menu:'Enter'}
const key=(key:string,code:string,extra:object={})=>({key,code,...extra})
test('gamepad keyboard releases by physical code even after the key label changes',()=>{
    const state=new KeyboardGamepadState()
    assert.equal(state.press(key('a','KeyA'),mapping),true)
    assert.deepEqual(state.read(),['A'])
    assert.equal(state.release(key('A','KeyA',{shiftKey:true})),true)
    assert.equal(state.pending,true);assert.deepEqual(state.read(),[]);assert.equal(state.pending,false)
})
test('keyboard gamepad ignores editing, shortcuts, composition and unmatched repeat events',()=>{
    const state=new KeyboardGamepadState()
    assert.equal(state.press(key('a','KeyA'),mapping,true),false)
    for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{defaultPrevented:true},{repeat:true}]){
        assert.equal(state.press(key('a','KeyA',extra),mapping),false)
    }
    assert.equal(state.pending,false)
    assert.equal(state.release(key('a','KeyA')),false)
})
test('already captured key repeats do not create duplicate state or change mappings',()=>{
    const state=new KeyboardGamepadState()
    state.press(key('a','KeyA'),mapping)
    assert.equal(state.press(key('A','KeyA',{repeat:true}),mapping),true)
    assert.deepEqual(state.read(),['A'])
    state.clear();assert.equal(state.pending,false);assert.deepEqual(state.read(),[])
})
test('independent physical keys can own the same emulated button until both are released',()=>{
    const state=new KeyboardGamepadState()
    state.press(key('a','KeyA'),mapping)
    state.press(key('a','OtherA'),mapping)
    state.release(key('a','KeyA'))
    assert.deepEqual(state.read(),['A'])
    state.release(key('a','OtherA'))
    assert.equal(state.pending,true);assert.deepEqual(state.read(),[])
})
test('editable and interactive controls are excluded from new keyboard captures',()=>{
    assert.equal(isEditableGamepadTarget(null),false)
    assert.equal(isEditableGamepadTarget({isContentEditable:true,closest:()=>null} as any),true)
    assert.equal(isEditableGamepadTarget({closest:()=>({})} as any),true)
    assert.equal(isEditableGamepadTarget({closest:()=>null} as any),false)
})
test('release without a physical code falls back to its key label',()=>{
    const state=new KeyboardGamepadState()
    state.press({key:'a',code:'Unidentified'},mapping)
    assert.equal(state.release({key:'a'}),true)
    assert.deepEqual(state.read(),[])
})
