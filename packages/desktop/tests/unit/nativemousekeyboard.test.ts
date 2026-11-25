import {test} from 'node:test'
import assert from 'node:assert/strict'
import MouseKeyboard from '../../../player/src/client/lib/input/mousekeyboard'
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve))
class Events{
    listeners=new Map<string,Set<(event:any)=>void>>()
    addEventListener(name:string,fn:(event:any)=>void){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name)!.add(fn)}
    removeEventListener(name:string,fn:(event:any)=>void){this.listeners.get(name)?.delete(fn)}
    fire(name:string,fields:object={}){const event={...fields,preventDefault(){}};for(const fn of [...(this.listeners.get(name)||[])])fn(event)}
}
function fixture(){
    const win=new Events(),doc=Object.assign(new Events(),{hidden:false,hasFocus:()=>true,pointerLockElement:null as any,exitPointerLock(){this.pointerLockElement=null;this.fire('pointerlockchange')}})
    const surface=Object.assign(new Events(),{isConnected:true,requestPointerLock:async()=>{doc.pointerLockElement=surface;doc.fire('pointerlockchange')}})
    const frames:any[]=[],mouse:any[]=[]
    const oldWin=Object.getOwnPropertyDescriptor(globalThis,'window'),oldDoc=Object.getOwnPropertyDescriptor(globalThis,'document')
    Object.defineProperty(globalThis,'window',{configurable:true,value:win});Object.defineProperty(globalThis,'document',{configurable:true,value:doc})
    const player={getVideoElement:()=>surface,_channels:{input:{queueKeyboardFrame:(f:any)=>frames.push(f),queueMouseFrame:(f:any)=>mouse.push(f)}}} as any
    const input=new MouseKeyboard(0);input.attach(player)
    return {win,doc,surface,input,player,frames,mouse,async lock(){surface.fire('click');await flush()},restore(){input.detach();if(oldWin)Object.defineProperty(globalThis,'window',oldWin);else Reflect.deleteProperty(globalThis,'window');if(oldDoc)Object.defineProperty(globalThis,'document',oldDoc);else Reflect.deleteProperty(globalThis,'document')}}
}
const key=(code:string,keyCode:number,key:string)=>({code,keyCode,key})
test('native keyboard coalesces physical keys with the same wire key and releases once',async()=>{
    const f=fixture();try{await f.lock()
        f.win.fire('keydown',key('ShiftLeft',16,'Shift'));f.win.fire('keydown',key('ShiftRight',16,'Shift'))
        f.win.fire('keyup',key('ShiftLeft',16,'Shift'));assert.deepEqual(f.frames.map(x=>x.pressed),[true])
        f.win.fire('keyup',key('ShiftRight',16,'Shift'));assert.deepEqual(f.frames.map(x=>x.pressed),[true,false])
        f.win.fire('keydown',key('KeyA',65,'a'));f.win.fire('keyup',key('KeyA',65,'A'));assert.equal(f.frames.at(-1).key,'a')
    }finally{f.restore()}
})
test('hidden native capture releases all input and requires a fresh click',async()=>{
    const f=fixture();try{await f.lock();f.win.fire('keydown',key('KeyA',65,'a'))
        f.win.fire('pointerdown',{pointerType:'mouse',buttons:1,movementX:0,movementY:0})
        f.doc.hidden=true;f.doc.fire('visibilitychange');assert.equal(f.doc.pointerLockElement,null)
        assert.equal(f.frames.at(-1).pressed,false);assert.equal(f.mouse.at(-1).Buttons,0)
        f.doc.hidden=false;f.win.fire('keydown',key('KeyB',66,'b'));assert.equal(f.frames.length,2)
        await f.lock();f.win.fire('keydown',key('KeyB',66,'b'));assert.equal(f.frames.length,3)
    }finally{f.restore()}
})
test('late pointer lock completion after detach is released and does not send input',async()=>{
    const f=fixture();try{
        let finish!:()=>void
        f.surface.requestPointerLock=()=>new Promise<void>(resolve=>{finish=()=>{f.doc.pointerLockElement=f.surface;resolve()}})
        f.surface.fire('click');f.input.detach();finish();await flush()
        assert.equal(f.doc.pointerLockElement,null)
        f.win.fire('keydown',key('KeyA',65,'a'));assert.deepEqual(f.frames,[])
        assert.equal([...f.win.listeners.values()].reduce((n,s)=>n+s.size,0),0)
    }finally{f.restore()}
})
test('mouse pointer cancellation releases buttons while keeping keyboard capture',async()=>{
    const f=fixture();try{await f.lock()
        f.win.fire('keydown',key('KeyA',65,'a'));f.win.fire('pointerdown',{pointerType:'mouse',buttons:1,movementX:NaN,movementY:Infinity})
        assert.equal(f.mouse.at(-1).X,0);assert.equal(f.mouse.at(-1).Y,0)
        f.win.fire('pointercancel',{pointerType:'mouse'});assert.equal(f.mouse.at(-1).Buttons,0)
        assert.equal(f.frames.length,1);assert.equal(f.doc.pointerLockElement,f.surface)
        f.win.fire('keydown',{...key('Process',229,'Process'),isComposing:true});assert.equal(f.frames.length,1)
    }finally{f.restore()}
})
