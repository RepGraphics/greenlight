import {test} from 'node:test'
import assert from 'node:assert/strict'
import {configureClassicControllerProfile,mapClassicPhysicalInput,resolveClassicControllerProfile} from '../../renderer/lib/classiccontrollerprofile'
const button=(value:number)=>({value,pressed:value>.5,touched:value>0})
test('Classic physical remapping respects analog values and missing buttons',()=>{
    const mapped=mapClassicPhysicalInput([button(.25),button(1)],[],{v3_button_mapping:{A:'1',B:'0',LeftTrigger:'0',Nexus:'63'}})
    assert.equal(mapped.buttons[0].value,1)
    assert.equal(mapped.buttons[1].value,.25)
    assert.equal(mapped.buttons[6].value,.25)
    assert.equal(mapped.buttons[16].value,0)
})
test('Classic deadzone, stick swapping and Y inversion preserve valid ranges',()=>{
    const mapped=mapClassicPhysicalInput([], [.05,1,-1,.55],{v3_deadzone:.1,v3_swap_sticks:true,v3_invert_y:true})
    assert.equal(mapped.axes[0],-1)
    assert.ok(Math.abs(mapped.axes[1]+.5)<1e-9)
    assert.equal(mapped.axes[2],0)
    assert.equal(mapped.axes[3],-1)
    assert.deepEqual(mapClassicPhysicalInput([],[NaN,Infinity,-10,10],{v3_deadzone:0}).axes,[0,0,-1,1])
})
test('Classic adapter retains original driver receiver and shadow-button behavior',()=>{
    const driver={shadow:1,mapStateLabels(buttons:ReadonlyArray<GamepadButton>,axes:ReadonlyArray<number>){return {A:buttons[0].value||this.shadow,axes}}}
    assert.equal(configureClassicControllerProfile(driver,{v3_deadzone:0,v3_button_mapping:{A:'1'}}),true)
    assert.equal(driver.mapStateLabels([button(0),button(0)],[0,0,0,0]).A,1)
    assert.equal(driver.mapStateLabels([button(1),button(.25)],[0,0,0,0]).A,.25)
    assert.equal(configureClassicControllerProfile(undefined,{}),false)
})
test('Classic selects named console/game profile or global defaults',()=>{
    const settings={v3_deadzone:.1,v3_controller_profiles:[{name:'Southpaw',v3_deadzone:.2,v3_swap_sticks:true}]}
    assert.equal(resolveClassicControllerProfile(settings,'Southpaw').v3_swap_sticks,true)
    assert.equal(resolveClassicControllerProfile(settings,'Southpaw').v3_deadzone,.2)
    assert.equal(resolveClassicControllerProfile(settings,'missing').v3_deadzone,.1)
})
