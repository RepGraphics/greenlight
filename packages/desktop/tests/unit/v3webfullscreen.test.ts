import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WebFullscreen} from '../../../desktop-v3/renderer/utils/webfullscreen'

function fixture(){
    let active:Element|null=null,requests=0,exits=0
    const doc={fullscreenEnabled:true,get fullscreenElement(){return active},async exitFullscreen(){exits++;active=null}}
    const target={isConnected:true,async requestFullscreen(){requests++;active=target as unknown as Element}}
    const surface=target as unknown as HTMLElement
    const controller=new WebFullscreen(doc,surface)
    return {controller,doc,target,surface,setActive:(value:Element|null)=>{active=value},counts:()=>({requests,exits})}
}
test('fullscreen requires browser support and a connected owned surface',()=>{
    const f=fixture()
    assert.equal(f.controller.state().available,true)
    f.doc.fullscreenEnabled=false
    assert.equal(f.controller.state().available,false)
    f.doc.fullscreenEnabled=true;f.target.isConnected=false
    assert.equal(f.controller.state().available,false)
    f.controller.dispose()
})
test('enter and exit fullscreen preserve the same target and reflect external browser exit',async()=>{
    const f=fixture()
    assert.equal(await f.controller.toggle(),true)
    assert.deepEqual(f.controller.state(),{active:true,available:true,busy:false})
    assert.equal(await f.controller.toggle(),true)
    assert.equal(f.controller.state().active,false)
    await f.controller.toggle();f.setActive(null)
    assert.equal(f.controller.state().active,false)
    assert.deepEqual(f.counts(),{requests:2,exits:1})
    f.controller.dispose()
})
test('fullscreen does not replace or close another element',async()=>{
    const f=fixture(),other={} as Element
    f.setActive(other)
    await assert.rejects(f.controller.toggle(),/unavailable/)
    f.setActive(null)
    await f.controller.toggle()
    f.setActive(other)
    f.controller.dispose()
    assert.equal(f.doc.fullscreenElement,other)
    assert.equal(f.counts().exits,0)
})
test('disposal exits only fullscreen opened by this controller',async()=>{
    const f=fixture()
    f.setActive(f.surface);f.controller.dispose()
    assert.equal(f.doc.fullscreenElement,f.surface)
    const next=fixture()
    await next.controller.toggle();next.controller.dispose()
    assert.equal(next.doc.fullscreenElement,null)
    assert.equal(next.counts().exits,1)
})
test('a pending request cannot overlap and a late entry after disposal is cleaned up',async()=>{
    const f=fixture()
    let resolve!:()=>void
    f.target.requestFullscreen=()=>new Promise<void>(done=>{resolve=()=>{f.setActive(f.surface);done()}})
    const pending=f.controller.toggle()
    assert.equal(f.controller.state().busy,true)
    assert.equal(await f.controller.toggle(),false)
    f.controller.dispose();resolve()
    assert.equal(await pending,false)
    assert.equal(f.doc.fullscreenElement,null)
    assert.equal(f.counts().exits,1)
})
test('a rejected fullscreen request clears busy state and permits retry',async()=>{
    const f=fixture()
    f.target.requestFullscreen=async()=>{throw Error('denied')}
    await assert.rejects(f.controller.toggle(),/denied/)
    assert.equal(f.controller.state().busy,false)
    assert.equal(f.controller.state().available,true)
    f.controller.dispose()
})

test('temporary disconnect releases an owned fullscreen session and prevents entry until reenabled',async()=>{
    const f=fixture();await f.controller.toggle()
    f.controller.setEnabled(false)
    assert.equal(f.doc.fullscreenElement,null)
    assert.equal(f.controller.state().available,false)
    assert.equal(await f.controller.toggle(),false)
    f.controller.setEnabled(true)
    assert.equal(await f.controller.toggle(),true)
    f.controller.dispose()
})
test('reconnection while a fullscreen request is pending does not create overlapping requests',async()=>{
    const f=fixture()
    let resolve!:()=>void
    f.target.requestFullscreen=()=>new Promise<void>(done=>{resolve=()=>{f.setActive(f.surface);done()}})
    const pending=f.controller.toggle()
    f.controller.setEnabled(false);f.controller.setEnabled(true)
    assert.equal(await f.controller.toggle(),false)
    resolve();assert.equal(await pending,false)
    assert.equal(f.controller.state().active,false)
    assert.equal(f.counts().exits,1)
    f.controller.dispose()
})
test('observed external fullscreen exit relinquishes prior ownership',async()=>{
    const f=fixture();await f.controller.toggle()
    f.setActive(null);assert.equal(f.controller.state().active,false)
    f.setActive(f.surface);f.controller.dispose()
    assert.equal(f.doc.fullscreenElement,f.surface)
    assert.equal(f.counts().exits,0)
})

test('a late cancelled fullscreen entry remains locked until its exit settles',async()=>{
    const f=fixture()
    let enter!:()=>void,exit!:()=>void
    f.target.requestFullscreen=()=>new Promise<void>(done=>{enter=()=>{f.setActive(f.surface);done()}})
    f.doc.exitFullscreen=()=>new Promise<void>(done=>{exit=()=>{f.setActive(null);done()}})
    const pending=f.controller.toggle()
    f.controller.setEnabled(false);f.controller.setEnabled(true);enter()
    await Promise.resolve()
    assert.equal(f.controller.state().busy,true)
    assert.equal(await f.controller.toggle(),false)
    exit();assert.equal(await pending,false)
    assert.equal(f.controller.state().active,false)
    assert.equal(f.controller.state().busy,false)
})
