import {test} from 'node:test'
import assert from 'node:assert/strict'
import {recommendLowerBitrate,recoveryBitrate} from '../../renderer/lib/bitrateadvisor'

const samples=()=>Array.from({length:20},(_,i)=>({elapsedSeconds:i,width:1920,height:1080,fps:60,bitrate:20,jitter:5,loss:0,rtt:40,statsFresh:true}))
const congested=(indices:number[])=>samples().map((s,i)=>indices.includes(i)?{...s,rtt:200}:s)

test('isolated spikes in both halves cannot trigger a bitrate downgrade',()=>{
    const data=congested([2,12])
    assert.equal(recommendLowerBitrate(data,20480),null)
    assert.equal(recoveryBitrate(data,20480,'transport',true),null)
})

test('congestion that has cleared in the second half cannot trigger a downgrade',()=>{
    assert.equal(recommendLowerBitrate(congested([0,1,2,3,4,5,6,7,8,9,10]),20480),null)
})

test('sustained poor readings in both halves retain conservative recovery',()=>{
    const data=congested([0,1,2,3,4,5,10,11,12,13,14,15])
    assert.equal(recommendLowerBitrate(data,20480),10240)
    assert.equal(recoveryBitrate(data,20480,'media',true),10240)
    assert.equal(recommendLowerBitrate(congested([0,1,2,3,4,10,11,12,13,14]),20480),null)
})

test('sustained jitter alone qualifies when round-trip latency is low',()=>{
    const data=samples().map(s=>({...s,jitter:45}))
    assert.equal(recommendLowerBitrate(data,8192),6144)
})
