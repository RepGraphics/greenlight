import {test} from 'node:test'
import assert from 'node:assert/strict'
import {StreamConnectionWatchdog,v3ProvisioningDeadlineMs,v3HandshakeDeadlineMs,v3DisconnectGraceMs} from '../../../player/src/client/lib/connectionwatchdog'
function fixture(){
    const callbacks=new Map<number,{fn:()=>void;delay:number}>(),failures:string[]=[]
    let id=0
    const watchdog=new StreamConnectionWatchdog(reason=>failures.push(reason),((fn:()=>void,delay:number)=>{callbacks.set(++id,{fn,delay});return id}) as any,((id:number)=>callbacks.delete(id)) as any)
    const current=()=>{const entry=callbacks.values().next().value;if(!entry)throw Error('No active timer');return entry}
    return {watchdog,callbacks,failures,current,expire(){current().fn()}}
}
test('V3 provisioning deadline expires even without a response',()=>{
    const f=fixture();f.watchdog.beginProvisioning();assert.equal(f.current().delay,v3ProvisioningDeadlineMs)
    f.expire();assert.deepEqual(f.failures,['server']);assert.equal(f.callbacks.size,0)
    f.watchdog.beginHandshake();assert.equal(f.callbacks.size,0)
})
test('V3 negotiation deadline covers the entire handshake and ignores old provisioning callbacks',()=>{
    const f=fixture();f.watchdog.beginProvisioning();const stale=f.current().fn
    f.watchdog.beginHandshake();stale();assert.deepEqual(f.failures,[]);assert.equal(f.current().delay,v3HandshakeDeadlineMs)
    f.watchdog.update('disconnected');assert.equal(f.current().delay,v3HandshakeDeadlineMs)
    f.expire();assert.deepEqual(f.failures,['transport'])
})
test('repeated disconnect or connecting events cannot extend the recovery window',()=>{
    const f=fixture();f.watchdog.beginProvisioning();f.watchdog.beginHandshake();f.watchdog.update('connected')
    assert.equal(f.callbacks.size,0);f.watchdog.update('disconnected');const first=f.current();assert.equal(first.delay,v3DisconnectGraceMs)
    f.watchdog.update('connecting');f.watchdog.update('disconnected');assert.equal(f.current(),first)
    f.expire();assert.deepEqual(f.failures,['transport'])
})
test('recovery cancels the old deadline and another disconnect gets a new one',()=>{
    const f=fixture();f.watchdog.beginProvisioning();f.watchdog.beginHandshake();f.watchdog.update('connected')
    f.watchdog.update('disconnected');const stale=f.current().fn
    f.watchdog.update('connected');f.watchdog.update('disconnected');stale()
    assert.deepEqual(f.failures,[]);assert.equal(f.callbacks.size,1)
    f.watchdog.update('failed');f.watchdog.update('closed');assert.deepEqual(f.failures,['transport']);assert.equal(f.callbacks.size,0)
})
test('disposal cancels deadlines and suppresses queued callbacks and events',()=>{
    const f=fixture();f.watchdog.beginProvisioning();f.watchdog.beginHandshake();const stale=f.current().fn
    f.watchdog.dispose();stale();f.watchdog.update('failed');assert.deepEqual(f.failures,[]);assert.equal(f.callbacks.size,0)
})
