import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectPhysicalGamepad} from '../../../player/src/client/lib/input/slots'
import Gamepad from '../../../player/src/client/lib/input/gamepad'

test('controller selection is stable, deterministic and respects occupied slots',()=>{
    assert.equal(selectPhysicalGamepad(-1,-1,[5,2,7,2],[2]),5)
    assert.equal(selectPhysicalGamepad(7,-1,[2,7,5],[]),7)
    assert.equal(selectPhysicalGamepad(7,-1,[2,5],[2]),5)
    assert.equal(selectPhysicalGamepad(-1,-1,[NaN,-1,1.2],[]),-1)
})
test('fixed multiplayer controller never switches to another physical pad',()=>{
    assert.equal(selectPhysicalGamepad(3,3,[2,5],[]),-1)
    assert.equal(selectPhysicalGamepad(-1,3,[3,5],[3]),-1)
    assert.equal(selectPhysicalGamepad(-1,3,[3,5],[]),3)
})
test('missing hotplug event sends a neutral frame before selecting a replacement',()=>{
    const savedNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator')
    const savedWindow=Object.getOwnPropertyDescriptor(globalThis,'window')
    let pads:any[]=[]
    const pad=(index:number)=>({index,connected:true,buttons:[{value:1}],axes:[0,0,0,0]})
    const handlers:Record<number,Gamepad>={}
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pads}})
    Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){}}})
    const controller=new Gamepad(0)
    try{
        pads=[pad(0),pad(1)]
        controller.attach({_channels:{control:{sendGamepadState:(index:number,added:boolean,handler:Gamepad)=>{if(added)handlers[index]=handler;else delete handlers[index]},getGamepadHandlers:()=>handlers}}} as any)
        assert.equal(controller.getPhysicalGamepadId(),0)
        assert.equal(controller.getGamepadState()?.A,1)
        pads=[null,pad(1)]
        const neutral=controller.getGamepadState()
        assert.equal(neutral?.A,0)
        assert.equal(controller.getPhysicalGamepadId(),1)
        assert.equal(controller.getGamepadState()?.A,1)
        pads=[null,null]
        assert.equal(controller.getGamepadState()?.A,0)
        assert.equal(controller.getGamepadState(),undefined)
        pads=[pad(0)]
        assert.equal(controller.getGamepadState()?.A,1)
    }finally{
        controller.detach()
        if(savedNavigator)Object.defineProperty(globalThis,'navigator',savedNavigator);else Reflect.deleteProperty(globalThis,'navigator')
        if(savedWindow)Object.defineProperty(globalThis,'window',savedWindow);else Reflect.deleteProperty(globalThis,'window')
    }
})
