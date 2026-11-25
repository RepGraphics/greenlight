import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ClassicRecoveryBudget} from '../../renderer/lib/sessionrecovery'

const failed={error:'closed',active:true,blocked:false}
test('Classic recovery is opt-in, Remote Play only and requires a prior connection',()=>{
    const budget=new ClassicRecoveryBudget()
    assert.equal(budget.delay(true,false,failed),null)
    budget.markConnected()
    assert.equal(budget.delay(false,false,failed),null)
    assert.equal(budget.delay(true,true,failed),null)
    assert.equal(budget.delay(true,false,failed),3000)
})
test('Classic recovery has two bounded attempts across player remounts',()=>{
    const budget=new ClassicRecoveryBudget()
    budget.markConnected()
    budget.recordRetry(true)
    assert.equal(budget.delay(true,false,{...failed,error:'provisioning'}),8000)
    budget.markConnected();budget.recordRetry(true)
    assert.equal(budget.delay(true,false,failed),null)
})
test('Classic recovery protects capture, cancellation and missing sessions',()=>{
    const budget=new ClassicRecoveryBudget()
    budget.markConnected()
    assert.equal(budget.delay(true,false,{...failed,blocked:true}),null)
    assert.equal(budget.delay(true,false,{...failed,active:false}),null)
    assert.equal(budget.delay(true,false,{...failed,error:''}),null)
    assert.equal(budget.delay(true,false,{...failed,error:'keepalive'}),3000)
})
test('manual retry starts a fresh recovery budget after a new connection',()=>{
    const budget=new ClassicRecoveryBudget()
    budget.markConnected();budget.recordRetry(true);budget.recordRetry(true)
    budget.recordRetry(false)
    assert.equal(budget.delay(true,false,failed),null)
    budget.markConnected()
    assert.equal(budget.delay(true,false,failed),3000)
})
