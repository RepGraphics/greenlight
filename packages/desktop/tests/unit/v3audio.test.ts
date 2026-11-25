import {test} from 'node:test'
import assert from 'node:assert/strict'
import AudioComponent,{normalizePlayback} from '../../../player/src/client/lib/render/audio'

function fixture(){
    const old=Object.getOwnPropertyDescriptor(globalThis,'document')
    const attached:any[]=[],created:any[]=[]
    let holderAvailable=true
    const holder={appendChild:(element:any)=>{assert.equal(element.muted,element.expectedMute);attached.push(element)}}
    let expectedMute=false
    Object.defineProperty(globalThis,'document',{configurable:true,value:{
        getElementById:()=>holderAvailable?holder:null,
        createElement:()=>{
            let source:any=null
            const element={volume:1,muted:false,autoplay:false,expectedMute,paused:false,
                get srcObject(){return source},set srcObject(value:any){if(value)assert.equal(this.muted,this.expectedMute);source=value},
                pause(){this.paused=true},remove(){const i=attached.indexOf(this);if(i>=0)attached.splice(i,1)}}
            created.push(element);return element
        }
    }})
    return {attached,created,expectMuted(value:boolean){expectedMute=value},missingHolder(){holderAvailable=false},player:{getElementId:()=> 'stream'} as any,restore(){if(old)Object.defineProperty(globalThis,'document',old);else Reflect.deleteProperty(globalThis,'document')}}
}
test('V3 audio volume is finite and clamped',()=>{
    assert.deepEqual(normalizePlayback(NaN,true),{volume:1,muted:true})
    assert.equal(normalizePlayback(-1,false).volume,0)
    assert.equal(normalizePlayback(2,false).volume,1)
})
test('V3 applies initial and updated playback preferences before attaching replacement audio',()=>{
    const f=fixture()
    try{
        f.expectMuted(true)
        const audio=new AudioComponent(f.player,0.25,true),stream={} as MediaStream
        audio.create(stream)
        const first=f.created[0];assert.equal(first.volume,0.25);assert.equal(first.muted,true)
        audio.setPlayback(0.6,false);assert.equal(first.volume,0.6);assert.equal(first.muted,false)
        f.expectMuted(false);audio.create(stream)
        assert.equal(first.paused,true);assert.equal(first.srcObject,null)
        assert.equal(f.attached.length,1);assert.equal(audio.getElement()?.volume,0.6)
        audio.destroy();assert.equal(audio.getElement(),undefined);assert.equal(f.attached.length,0)
    }finally{f.restore()}
})
test('V3 audio disposal removes only the owned element and does not stop remote tracks',()=>{
    const f=fixture()
    try{
        const external={};f.attached.push(external)
        const audio=new AudioComponent(f.player)
        const stream={getTracks(){assert.fail('must not stop remote tracks')}} as unknown as MediaStream
        audio.create(stream);audio.destroy();audio.destroy()
        assert.deepEqual(f.attached,[external]);assert.equal(f.created[0].srcObject,null)
        f.missingHolder();audio.create(stream);assert.equal(f.created.length,1)
    }finally{f.restore()}
})
