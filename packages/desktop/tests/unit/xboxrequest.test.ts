import {test} from 'node:test'
import assert from 'node:assert/strict'
import {EventEmitter} from 'node:events'
import {requestXboxJson} from '../../main/helpers/xboxrequest'
function fixture(){
    const timers=new Map<number,()=>void>()
    let count=0,requests=0,destroyed=0,ended=0
    const writes:string[]=[]
    let receive!:(res:any)=>void
    const req=Object.assign(new EventEmitter(),{destroy(){destroyed++;return this},write(value:string){writes.push(value)},end(){ended++}})
    const start=(body?:string)=>requestXboxJson(((options:any,callback:any)=>{requests++;receive=callback;return req}) as any,{host:'example.test',method:body===undefined?'GET':'POST'},body,15000,((fn:()=>void)=>{timers.set(++count,fn);return count}) as any,((id:number)=>timers.delete(id)) as any)
    const respond=(statusCode=200)=>{const response=Object.assign(new EventEmitter(),{statusCode,complete:false,destroy(){return this}});receive(response);return response}
    return {start,respond,req,timers,writes,get requests(){return requests},get destroyed(){return destroyed},get ended(){return ended},expire(){for(const fn of [...timers.values()])fn()}}
}
test('Xbox API absolute deadline covers a request with no response headers',async()=>{
    const f=fixture(),pending=f.start()
    const rejected=assert.rejects(pending,/timed out/)
    f.expire();await rejected
    assert.equal(f.destroyed,1);assert.equal(f.requests,1);assert.equal(f.timers.size,0)
})
test('partial response activity cannot extend the absolute deadline',async()=>{
    const f=fixture(),pending=f.start('{}'),res=f.respond()
    const rejected=assert.rejects(pending,/timed out/)
    res.emit('data',Buffer.from('{"part":'));f.expire();await rejected
    res.emit('data',Buffer.from('true}'));res.complete=true;res.emit('end')
    assert.equal(f.requests,1);assert.equal(f.destroyed,1);assert.deepEqual(f.writes,['{}'])
})
test('aborted and prematurely closed responses reject and clear deadline',async()=>{
    for(const event of ['aborted','close','error']){
        const f=fixture(),pending=f.start(),res=f.respond()
        const rejected=assert.rejects(pending,/interrupted/)
        res.emit(event,Error('closed'));await rejected
        assert.equal(f.destroyed,1);assert.equal(f.timers.size,0)
    }
})
test('successful responses decode split UTF-8 and preserve HTTP status and body',async()=>{
    const f=fixture(),pending=f.start(),res=f.respond(201)
    const bytes=Buffer.from('{"name":"🎮"}')
    res.emit('data',bytes.subarray(0,12));res.emit('data',bytes.subarray(12))
    res.complete=true;res.emit('end');res.emit('close');f.req.emit('close')
    assert.deepEqual(await pending,{status:201,body:'{"name":"🎮"}',data:{name:'🎮'}})
    assert.equal(f.timers.size,0);assert.equal(f.destroyed,0);assert.equal(f.ended,1)
})
test('HTTP errors and empty 204 responses preserve status for higher-level handling',async()=>{
    for(const status of [204,404,410,503]){
        const f=fixture(),pending=f.start(),res=f.respond(status)
        if(status!==204)res.emit('data','service error')
        res.complete=true;res.emit('end')
        const result=await pending
        assert.equal(result.status,status);assert.equal(result.body,status===204?'':'service error')
        assert.equal(f.requests,1);assert.equal(f.timers.size,0)
    }
})
test('transport errors and incomplete end events settle once',async()=>{
    const f=fixture(),pending=f.start()
    const rejected=assert.rejects(pending,/offline/)
    f.req.emit('error',Error('offline'));f.req.emit('close');await rejected
    assert.equal(f.destroyed,1);assert.equal(f.timers.size,0)
    const g=fixture(),incomplete=g.start(),res=g.respond()
    const incompleteRejected=assert.rejects(incomplete,/Incomplete/)
    res.emit('end');await incompleteRejected
})
