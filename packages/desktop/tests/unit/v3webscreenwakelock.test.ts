import {test} from 'node:test'
import assert from 'node:assert/strict'
import {WebScreenWakeLock,type ScreenWakeState} from '../../../desktop-v3/renderer/utils/webscreenwakelock'

class Lease extends EventTarget{
    released=false
    releases=0
    async release(){this.releases++;this.released=true;this.dispatchEvent(new Event('release'))}
}
function fixture(visible=true){
    const states:ScreenWakeState[]=[]
    const leases:Lease[]=[]
    const controller=new WebScreenWakeLock(async()=>{const lease=new Lease();leases.push(lease);return lease},visible,state=>states.push(state))
    return {controller,states,leases}
}
test('wake lock is opt-in and disabling releases the owned sentinel',async()=>{
    const f=fixture()
    assert.equal(f.leases.length,0)
    await f.controller.setEnabled(true)
    assert.deepEqual(f.states,['requesting','active'])
    await f.controller.setEnabled(true)
    assert.equal(f.leases.length,1)
    await f.controller.setEnabled(false)
    assert.equal(f.leases[0].releases,1)
    assert.equal(f.states.at(-1),'off')
})
test('hidden pages release the lock and visible enabled pages reacquire it',async()=>{
    const f=fixture(false)
    await f.controller.setEnabled(true)
    assert.equal(f.leases.length,0)
    assert.equal(f.states.at(-1),'paused')
    await f.controller.setVisible(true)
    assert.equal(f.states.at(-1),'active')
    await f.controller.setVisible(false)
    assert.equal(f.leases[0].released,true)
    assert.equal(f.states.at(-1),'paused')
    await f.controller.setVisible(true)
    assert.equal(f.leases.length,2)
    f.controller.dispose()
    assert.equal(f.leases[1].released,true)
})
test('pending requests are single flight and disposal releases late results',async()=>{
    let resolve!:(lease:Lease)=>void,requests=0
    const states:ScreenWakeState[]=[]
    const controller=new WebScreenWakeLock(()=>{requests++;return new Promise<Lease>(done=>{resolve=done})},true,state=>states.push(state))
    const pending=controller.setEnabled(true)
    await controller.retry()
    assert.equal(requests,1)
    controller.dispose()
    const count=states.length,lease=new Lease()
    resolve(lease);await pending
    assert.equal(lease.released,true)
    assert.equal(states.length,count)
})
test('late requests after hiding or disabling never become active',async()=>{
    for(const action of ['hide','disable']){
        let resolve!:(lease:Lease)=>void
        const states:ScreenWakeState[]=[]
        const controller=new WebScreenWakeLock(()=>new Promise<Lease>(done=>{resolve=done}),true,state=>states.push(state))
        const pending=controller.setEnabled(true)
        if(action==='hide')await controller.setVisible(false)
        else await controller.setEnabled(false)
        const lease=new Lease()
        resolve(lease);await pending
        assert.equal(lease.released,true)
        assert.equal(states.includes('active'),false)
        assert.equal(states.at(-1),action==='hide'?'paused':'off')
        controller.dispose()
    }
})
test('browser release reports paused without automatically retrying in a loop',async()=>{
    const f=fixture()
    await f.controller.setEnabled(true)
    await f.leases[0].release()
    assert.equal(f.states.at(-1),'paused')
    assert.equal(f.leases.length,1)
    await f.controller.retry()
    assert.equal(f.leases.length,2)
    assert.equal(f.states.at(-1),'active')
    f.controller.dispose()
})
test('unsupported and rejected requests are safe and explicitly retryable',async()=>{
    const states:ScreenWakeState[]=[]
    const unsupported=new WebScreenWakeLock(undefined,true,state=>states.push(state))
    await unsupported.setEnabled(true)
    assert.equal(states.at(-1),'unavailable')
    unsupported.dispose()
    let count=0
    const controller=new WebScreenWakeLock(async()=>{if(++count===1)throw Error('denied');return new Lease()},true,state=>states.push(state))
    await controller.setEnabled(true)
    assert.equal(states.at(-1),'failed')
    await controller.retry()
    assert.equal(states.at(-1),'active')
    controller.dispose()
})
