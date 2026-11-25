import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeClassicVolume,observeClassicAudio} from '../../renderer/lib/classicaudio'

test('Classic volume is finite and clamped to the HTML media range',()=>{
    assert.equal(normalizeClassicVolume(-1),0)
    assert.equal(normalizeClassicVolume(2),1)
    assert.equal(normalizeClassicVolume(0.4),0.4)
    assert.equal(normalizeClassicVolume(NaN,0.3),0.3)
    assert.equal(normalizeClassicVolume(Infinity,0.5),0.5)
})

test('Classic playback preferences survive delayed audio attachment and element replacement',()=>{
    const old=Object.getOwnPropertyDescriptor(globalThis,'MutationObserver')
    let notify=()=>{}
    let disconnected=false
    class Observer {
        constructor(callback:()=>void){notify=callback}
        observe(_holder:unknown,options:MutationObserverInit){assert.deepEqual(options,{childList:true,subtree:true})}
        disconnect(){disconnected=true}
    }
    Object.defineProperty(globalThis,'MutationObserver',{value:Observer,configurable:true,writable:true})
    let audio:{volume:number;muted:boolean}|null=null
    const holder={querySelector:(selector:string)=>{assert.equal(selector,'audio');return audio}} as unknown as HTMLElement
    let stop:(()=>void)|undefined
    try{
        stop=observeClassicAudio(holder,0.35,true)
        audio={volume:1,muted:false}
        notify()
        assert.deepEqual(audio,{volume:0.35,muted:true})
        audio={volume:1,muted:false}
        notify()
        assert.deepEqual(audio,{volume:0.35,muted:true})
        stop()
        assert.equal(disconnected,true)
        audio={volume:1,muted:false}
        notify()
        assert.deepEqual(audio,{volume:1,muted:false})
        stop=observeClassicAudio(holder,0.6,false)
        assert.deepEqual(audio,{volume:0.6,muted:false})
    }finally{
        stop?.()
        if(old)Object.defineProperty(globalThis,'MutationObserver',old)
        else Reflect.deleteProperty(globalThis,'MutationObserver')
    }
})
