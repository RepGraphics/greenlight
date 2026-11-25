import {test} from 'node:test'
import assert from 'node:assert/strict'
import {classicDisconnectGraceMs,watchClassicConnection} from '../../renderer/lib/classicconnection'

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
