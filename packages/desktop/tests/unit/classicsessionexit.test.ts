import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ClassicSessionExit} from '../../renderer/lib/classicsessionexit'

test('Classic exit waits for acknowledgement and deduplicates repeated or unmount stops',async()=>{
    const exit=new ClassicSessionExit(),owner={current:'a'}
    let resolve!:()=>void,calls=0
    const request=(id:string)=>{assert.equal(id,'a');calls++;return new Promise<void>(done=>{resolve=done})}
    const first=exit.stop(owner,request),second=exit.stop(owner,request)
    assert.equal(first,second);assert.equal(exit.busy,true)
    await Promise.resolve()
    assert.equal(calls,1);assert.equal(owner.current,'a')
    resolve()
    assert.equal(await first,true);assert.equal(owner.current,'');assert.equal(exit.busy,false)
})
test('Classic exit retains ownership on failure and permits explicit retry',async()=>{
    const exit=new ClassicSessionExit(),owner={current:'a'}
    assert.equal(await exit.stop(owner,async()=>{throw Error('network')}),false)
    assert.equal(owner.current,'a');assert.equal(exit.busy,false)
    assert.equal(await exit.stop(owner,async()=>true),true)
    assert.equal(owner.current,'')
})
test('Classic exit without a remote session does not issue IPC',async()=>{
    const exit=new ClassicSessionExit(),owner={current:''}
    assert.equal(await exit.stop(owner,async()=>assert.fail('unexpected stop')),true)
    assert.equal(exit.busy,false)
})
test('late acknowledgement cannot clear a different owned session',async()=>{
    const exit=new ClassicSessionExit(),owner={current:'a'}
    let resolve!:()=>void
    const first=exit.stop(owner,()=>new Promise<void>(done=>{resolve=done}))
    await Promise.resolve()
    owner.current='b';resolve()
    assert.equal(await first,true);assert.equal(owner.current,'b')
})
