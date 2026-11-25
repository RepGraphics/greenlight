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
    const savedDocument=Object.getOwnPropertyDescriptor(globalThis,'document')
    let pads:any[]=[]
    const pad=(index:number)=>({index,connected:true,buttons:[{value:1}],axes:[0,0,0,0]})
    const handlers:Record<number,Gamepad>={}
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pads}})
    Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener(){},removeEventListener(){}}})
    Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,hasFocus:()=>true,addEventListener(){},removeEventListener(){}}})
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
        if(savedDocument)Object.defineProperty(globalThis,'document',savedDocument);else Reflect.deleteProperty(globalThis,'document')
    }
})

test('keyboard-only controller releases held input on visibility loss and focus changes',()=>{
    const win=Object.getOwnPropertyDescriptor(globalThis,'window'),doc=Object.getOwnPropertyDescriptor(globalThis,'document')
    const windowListeners=new Map<string,()=>void>(),documentListeners=new Map<string,()=>void>()
    const surface={hidden:false,hasFocus:()=>!surface.hidden,addEventListener:(name:string,fn:()=>void)=>documentListeners.set(name,fn),removeEventListener:(name:string)=>documentListeners.delete(name)}
    Object.defineProperty(globalThis,'window',{configurable:true,value:{addEventListener:(name:string,fn:()=>void)=>windowListeners.set(name,fn),removeEventListener:(name:string)=>windowListeners.delete(name)}})
    Object.defineProperty(globalThis,'document',{configurable:true,value:surface})
    const controller=new Gamepad(0,{enable_gamepad:false,enable_keyboard:true,keyboard_mapping:{A:'a'}})
    const event=(key:string)=>({key,code:'KeyA',preventDefault(){}} as KeyboardEvent)
    try{
        controller.attach({_channels:{control:{sendGamepadState(){},getGamepadHandlers:()=>({})}}} as any)
        assert.ok(windowListeners.has('blur'));assert.ok(documentListeners.has('visibilitychange'))
        controller.onKeyDown(event('a'));assert.equal(controller.getGamepadState()?.A,1)
        surface.hidden=true;documentListeners.get('visibilitychange')!();assert.equal(controller.getGamepadState()?.A,0)
        assert.equal(controller.getGamepadState(),undefined)
        surface.hidden=false;documentListeners.get('visibilitychange')!();assert.equal(controller.getGamepadState(),undefined)
        controller.onKeyDown(event('a'));assert.equal(controller.getGamepadState()?.A,1)
        controller.onKeyUp(event('A'));assert.equal(controller.getGamepadState()?.A,0)
    }finally{
        controller.detach();assert.equal(windowListeners.size,0);assert.equal(documentListeners.size,0)
        if(win)Object.defineProperty(globalThis,'window',win);else Reflect.deleteProperty(globalThis,'window')
        if(doc)Object.defineProperty(globalThis,'document',doc);else Reflect.deleteProperty(globalThis,'document')
    }
})
