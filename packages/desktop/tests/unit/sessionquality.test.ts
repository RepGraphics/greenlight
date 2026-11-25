import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validSessionBitrate,sessionBitrates,selectableSessionBitrates,parseSessionBitrate,sessionBitrateLabel} from '../../renderer/lib/sessionquality'
import {ClassicRecoveryBudget} from '../../renderer/lib/sessionrecovery'

test('session bitrate options match streaming settings and exclude the active cap',()=>{
    assert.equal(sessionBitrates.length,41)
    assert.equal(sessionBitrates[0],0)
    assert.equal(sessionBitrates.at(-1),40960)
    assert.equal(selectableSessionBitrates(8192).length,40)
    assert.ok(!selectableSessionBitrates(8192).includes(8192))
    assert.ok(selectableSessionBitrates(8192).includes(0))
})
test('session bitrate selection rejects malformed values and allows automatic mode',()=>{
    for(const value of ['', ' ', '-1','1','40961','1e4','NaN','Infinity','0x400','1024.0'])assert.equal(parseSessionBitrate(value),null)
    assert.equal(parseSessionBitrate('0'),0)
    assert.equal(parseSessionBitrate('1024'),1024)
    assert.equal(parseSessionBitrate('40960'),40960)
    assert.equal(validSessionBitrate('1024'),false)
    assert.equal(sessionBitrateLabel(0,'Automatic'),'Automatic')
})
test('Classic session overrides retain automatic mode without mutating the saved cap',()=>{
    const budget=new ClassicRecoveryBudget(),saved=10240
    assert.equal(budget.bitrateOverride??saved,saved)
    budget.applyBitrate(4096);assert.equal(budget.bitrateOverride,4096)
    budget.applyBitrate(0);assert.equal(budget.bitrateOverride??saved,0)
    budget.applyBitrate(-1);budget.applyBitrate(50000);budget.applyBitrate(NaN)
    assert.equal(budget.bitrateOverride,0)
    assert.equal(new ClassicRecoveryBudget().bitrateOverride??saved,saved)
})
