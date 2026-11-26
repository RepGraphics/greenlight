import {test} from 'node:test'
import assert from 'node:assert/strict'
import {webBindingTargets,updateWebBinding,readBindingPads,WebButtonListener} from '../../../desktop-v3/renderer/utils/webbuttonbindings'
import {defaultButtonMapping} from '../../../player/src/client/lib/input/mapping'
const pad=(buttons:number[],index=0,id='controller')=>({index,id,buttons})
test('web binding editor exposes every supported Xbox button and preserves unrelated mappings',()=>{
    assert.deepEqual(webBindingTargets,Object.keys(defaultButtonMapping))
    const mapping={...defaultButtonMapping}
    const changed=updateWebBinding(mapping,'A','63')
    assert.deepEqual(changed,{...mapping,A:'63'})
    assert.equal(mapping.A,'0')
    assert.equal(updateWebBinding(changed,'A','0').A,'0')
    assert.equal(updateWebBinding(changed,'A','63'),changed)
})
test('invalid targets and button indices never modify mappings',()=>{
    const mapping={...defaultButtonMapping}
    for(const value of ['64','-1','01','1.5','NaN','1e1',' 2','']){
        assert.equal(updateWebBinding(mapping,'A',value),mapping)
    }
    for(const target of ['__proto__','constructor','Unknown'])assert.equal(updateWebBinding(mapping,target,'1'),mapping)
})
test('controller snapshots omit disconnected devices and cap button count',()=>{
    const connected={connected:true,index:2,id:'pad',buttons:Array.from({length:80},()=>({value:.5}))} as unknown as Gamepad
    assert.deepEqual(readBindingPads([null,{connected:false} as Gamepad,connected]),[{index:2,id:'pad',buttons:Array(64).fill(.5)}])
})
test('button listener ignores a held button until released and pressed again',()=>{
    const listener=new WebButtonListener(pad([1,0]),10000)
    assert.deepEqual(listener.sample([pad([1,0])],100,true),{kind:'waiting'})
    assert.deepEqual(listener.sample([pad([0,0])],200,true),{kind:'waiting'})
    assert.deepEqual(listener.sample([pad([1,0])],300,true),{kind:'captured',index:0})
})
test('ambiguous presses require releasing all buttons before listening resumes',()=>{
    const listener=new WebButtonListener(pad([0,0]),10000)
    assert.deepEqual(listener.sample([pad([1,1])],100,true),{kind:'ambiguous'})
    assert.deepEqual(listener.sample([pad([0,1])],200,true),{kind:'ambiguous'})
    assert.deepEqual(listener.sample([pad([0,0])],300,true),{kind:'waiting'})
    assert.deepEqual(listener.sample([pad([0,1])],400,true),{kind:'captured',index:1})
})
test('button listening fails when focus, deadline or selected controller identity is lost',()=>{
    for(const [pads,now,focused] of [[[],100,true],[[pad([1],1)],100,true],[[pad([1],0,'replacement')],100,true],[[pad([1])],10000,true],[[pad([1])],100,false]] as const){
        const listener=new WebButtonListener(pad([0]),10000)
        assert.deepEqual(listener.sample([...pads],now,focused),{kind:'failed'})
    }
})
