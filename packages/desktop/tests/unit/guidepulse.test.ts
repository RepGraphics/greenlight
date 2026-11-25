import {test} from 'node:test'
import assert from 'node:assert/strict'
import {GuidePulse} from '../../../player/src/client/lib/input/guidepulse'
import Gamepad from '../../../player/src/client/lib/input/gamepad'

test('guide pulse begins at the first sample and retains a release frame',()=>{
    const pulse=new GuidePulse()
    assert.equal(pulse.request(),true);assert.equal(pulse.request(),false)
    assert.equal(pulse.pending,true);assert.equal(pulse.sample(10000),true)
    assert.equal(pulse.sample(10119),true);assert.equal(pulse.pending,true)
    assert.equal(pulse.sample(10120),false);assert.equal(pulse.pending,false)
    assert.equal(pulse.request(),true);assert.equal(pulse.sample(20000),true)
})
test('guide cancellation prevents delayed input after focus loss',()=>{
    const pulse=new GuidePulse()
    pulse.request();pulse.clear();assert.equal(pulse.sample(100),false)
    pulse.request();pulse.sample(200);pulse.clear();assert.equal(pulse.sample(201),false)
    assert.equal(pulse.pending,false)
})
test('guide pulse uses existing controller, preserves another held button and clears on blur',()=>{
    const saved=['navigator','window','document'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const)
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[]}})
    Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){}}})
    Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,hasFocus:()=>true,addEventListener(){},removeEventListener(){}}})
    const controller=new Gamepad(0,{enable_gamepad:false})
    const registrations:boolean[]=[]
    try{
        assert.equal(controller.pressGuide(),false)
        controller.attach({_channels:{control:{sendGamepadState:(_index:number,added:boolean)=>registrations.push(added),getGamepadHandlers:()=>({})}}} as any)
        controller.sendButtonState('A',1);assert.equal(controller.pressGuide(),true)
        const frame=controller.getGamepadState()!
        assert.equal(frame.Nexus,1);assert.equal(frame.A,1)
        assert.deepEqual(registrations,[true])
        controller.onWindowBlur();assert.equal(controller.getGamepadState()?.Nexus,0)
        assert.equal(controller.pressGuide(),false)
        controller.onWindowFocus();assert.equal(controller.getGamepadState(),undefined)
    }finally{controller.detach();for(const [name,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name)}}
})
