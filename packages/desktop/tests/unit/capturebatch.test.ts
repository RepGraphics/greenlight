import {test} from 'node:test'
import assert from 'node:assert/strict'
import {deleteCaptures,validatedCaptureIds,visibleCaptureSelection,captureLimitCount} from '../../renderer/lib/capturelibrary'
import type {CaptureInfo} from '../../renderer/lib/capturelibrary'

test('capture selection accepts bounded unique IDs and rejects malformed batches',async()=>{
    assert.deepEqual(validatedCaptureIds(['a','a','b']),['a','b'])
    for(const value of [null,'a',[''],['a',42],['x'.repeat(129)],Array(captureLimitCount+1).fill('a')]){
        assert.throws(()=>validatedCaptureIds(value))
        await assert.rejects(deleteCaptures(value),/Invalid capture selection/)
    }
    await deleteCaptures([])
})
test('selection resolves only items in the visible filtered view',()=>{
    const entries:CaptureInfo[]=[{id:'a',kind:'clip',name:'a.webm',createdAt:1,size:10},{id:'b',kind:'screenshot',name:'b.png',createdAt:2,size:20}]
    assert.deepEqual(visibleCaptureSelection(entries.slice(1),new Set(['a','b','missing'])).map(item=>item.id),['b'])
})
test('bulk capture deletion queues both stores in one readwrite transaction and waits for commit',async()=>{
    const old=Object.getOwnPropertyDescriptor(globalThis,'indexedDB')
    const writes:string[]=[]
    let tx:any
    let transactions=0,closed=false
    const db={transaction(stores:string[],mode:string){transactions++;assert.deepEqual(stores,['captures','index']);assert.equal(mode,'readwrite');tx={objectStore:(name:string)=>({delete:(id:string)=>writes.push(name+':'+id)})};return tx},close(){closed=true}}
    Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){const request:any={result:db};queueMicrotask(()=>request.onsuccess());return request}}})
    try{
        let finished=false
        const pending=deleteCaptures(['a','b','a']).then(()=>{finished=true})
        await new Promise<void>(resolve=>setImmediate(resolve))
        assert.equal(transactions,1)
        assert.deepEqual(writes,['captures:a','index:a','captures:b','index:b'])
        assert.equal(finished,false)
        tx.oncomplete();await pending
        assert.equal(finished,true);assert.equal(closed,true)
    }finally{if(old)Object.defineProperty(globalThis,'indexedDB',old);else Reflect.deleteProperty(globalThis,'indexedDB')}
})
test('failed capture transaction rejects rather than reporting a successful deletion',async()=>{
    const old=Object.getOwnPropertyDescriptor(globalThis,'indexedDB')
    let tx:any,closed=false
    const db={transaction(){tx={error:new Error('quota'),objectStore:()=>({delete(){}})};return tx},close(){closed=true}}
    Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){const request:any={result:db};queueMicrotask(()=>request.onsuccess());return request}}})
    try{
        const result=assert.rejects(deleteCaptures(['a']),/quota/)
        await new Promise<void>(resolve=>setImmediate(resolve))
        tx.onabort();await result
        assert.equal(closed,true)
    }finally{if(old)Object.defineProperty(globalThis,'indexedDB',old);else Reflect.deleteProperty(globalThis,'indexedDB')}
})
