import {test} from 'node:test'
import assert from 'node:assert/strict'
import {classicDisconnectGraceMs,classicHandshakeDeadlineMs,watchClassicConnection} from '../../renderer/lib/classicconnection'

function clock(){
    let next:(()=>void)|undefined
    let scheduled=0
    return {
        schedule:((callback:()=>void,delay:number)=>{
            assert.equal(delay,classicDisconnectGraceMs)
            scheduled++;next=callback
            return scheduled as unknown as ReturnType<typeof setTimeout>
        }) as typeof setTimeout,
        cancel:((_:ReturnType<typeof setTimeout>)=>{next=undefined}) as typeof clearTimeout,
        get scheduled(){return scheduled},
        get pending(){return Boolean(next)},
        run(){const callback=next;next=undefined;callback?.()}
    }
}
test('transient Classic disconnection recovers without ending the stream',()=>{
    const time=clock();let failures=0
    const watch=watchClassicConnection(()=>failures++,time.schedule,time.cancel)
    watch.update('connected');watch.update('disconnected')
    assert.equal(time.pending,true)
    watch.update('connected');time.run()
    assert.equal(failures,0);assert.equal(watch.failed,false)
    watch.dispose()
})
test('persistent disconnection fails once without extending the deadline',()=>{
    const time=clock();let failures=0
    const watch=watchClassicConnection(()=>failures++,time.schedule,time.cancel)
    watch.update('disconnected');watch.update('connecting');watch.update('disconnected')
    assert.equal(time.scheduled,1)
    time.run();watch.update('failed');watch.update('closed');watch.update('connected')
    assert.equal(failures,1);assert.equal(watch.failed,true);assert.equal(time.pending,false)
})
test('failed and closed states immediately trigger exactly one failure',()=>{
    for(const state of ['failed','closed']){
        const time=clock();let failures=0
        const watch=watchClassicConnection(()=>failures++,time.schedule,time.cancel)
        watch.update('disconnected');watch.update(state);time.run()
        assert.equal(failures,1);assert.equal(time.pending,false)
    }
})
test('disposing Classic watcher prevents a pending timeout from failing a replacement stream',()=>{
    const time=clock()
    const watch=watchClassicConnection(()=>assert.fail('late failure'),time.schedule,time.cancel)
    watch.update('disconnected');watch.dispose();time.run();watch.update('failed')
    assert.equal(time.pending,false);assert.equal(watch.failed,false)
})

function handshakeClock(){
    let id=0
    const timers=new Map<number,{callback:()=>void;delay:number}>()
    const schedule=((callback:()=>void,delay:number)=>{timers.set(++id,{callback,delay});return id}) as unknown as typeof setTimeout
    const cancel=((id:number)=>timers.delete(id)) as unknown as typeof clearTimeout
    return {schedule,cancel,timers,expire(delay:number){for(const [id,entry] of [...timers])if(entry.delay===delay){timers.delete(id);entry.callback()}}}
}
test('Classic handshake is bounded even when connecting events never settle',()=>{
    const time=handshakeClock();let failures=0
    const watch=watchClassicConnection(()=>failures++,time.schedule,time.cancel)
    watch.begin();watch.begin();watch.update('new');watch.update('connecting')
    assert.equal(time.timers.size,1)
    time.expire(classicHandshakeDeadlineMs)
    assert.equal(failures,1);assert.equal(watch.failed,true)
    watch.update('connected');watch.begin();assert.equal(time.timers.size,0)
})
test('successful connection clears the initial handshake timer and does not restart it',()=>{
    const time=handshakeClock()
    const watch=watchClassicConnection(()=>assert.fail('late handshake failure'),time.schedule,time.cancel)
    watch.begin();watch.update('connected');watch.begin()
    assert.equal(time.timers.size,0)
    time.expire(classicHandshakeDeadlineMs)
    watch.update('disconnected');assert.equal([...time.timers.values()][0].delay,classicDisconnectGraceMs)
    watch.dispose();assert.equal(time.timers.size,0)
})
test('failed or disposed handshake clears both watchdog deadlines',()=>{
    const time=handshakeClock();let failures=0
    const watch=watchClassicConnection(()=>failures++,time.schedule,time.cancel)
    watch.begin();watch.update('disconnected')
    assert.equal(time.timers.size,2)
    time.expire(classicDisconnectGraceMs)
    assert.equal(failures,1);assert.equal(time.timers.size,0)
    const replacement=watchClassicConnection(()=>assert.fail('disposed handshake'),time.schedule,time.cancel)
    replacement.begin();replacement.dispose();time.expire(classicHandshakeDeadlineMs)
    assert.equal(time.timers.size,0)
})
