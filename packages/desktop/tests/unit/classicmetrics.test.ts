import {test} from 'node:test'
import assert from 'node:assert/strict'
import {ClassicMetricsSampler} from '../../renderer/lib/classicmetrics'
import {ClassicRecoveryBudget} from '../../renderer/lib/sessionrecovery'
import {recommendLowerBitrate} from '../../renderer/lib/bitrateadvisor'
const video=(bytesReceived:number,timestamp:number,id='primary')=>({type:'inbound-rtp',kind:'video',id,bytesReceived,timestamp,frameWidth:1920,frameHeight:1080,framesPerSecond:60,jitter:.02,packetsLost:10})
const stats=(...reports:any[])=>new Map(reports.map(report=>[report.id,report]))
test('Classic metrics calculate bitrate and RTT only from one advancing video stream',()=>{
    const sampler=new ClassicMetricsSampler()
    const transport={type:'transport',id:'t',selectedCandidatePairId:'pair'},pair={id:'pair',currentRoundTripTime:.04}
    assert.equal(sampler.sample(stats(video(1000,1000),transport,pair),1000).statsFresh,false)
    const next=sampler.sample(stats(video(1001000,2000),{...video(9000000,2000,'secondary'),frameWidth:320,frameHeight:180},transport,pair),2000)
    assert.equal(next.bitrate,8);assert.equal(next.rtt,40);assert.equal(next.statsFresh,true)
})
test('Classic metrics reject frozen counters, discontinuities and changed tracks',()=>{
    const sampler=new ClassicMetricsSampler()
    sampler.sample(stats(video(100,1000)),1000)
    assert.equal(sampler.sample(stats(video(100,2000)),2000).statsFresh,false)
    assert.equal(sampler.sample(stats(video(200,6000)),6000).statsFresh,false)
    assert.equal(sampler.sample(stats(video(300,7000,'replacement')),7000).statsFresh,false)
    assert.equal(sampler.sample(stats(),8000).statsFresh,false)
    assert.equal(sampler.sample(stats(video(900,9000)),9000).statsFresh,false)
})
test('Classic session retains bounded previous attempts and an explicit bitrate override',()=>{
    const recovery=new ClassicRecoveryBudget()
    const sample={width:1920,height:1080,fps:60,rtt:180,jitter:40,loss:0,bitrate:10,statsFresh:true,elapsedSeconds:0}
    for(let i=0;i<5;i++)recovery.rememberAttempt('closed',[{...sample,elapsedSeconds:i}])
    assert.equal(recovery.previousAttempts.length,3)
    assert.equal(recovery.previousAttempts[0].samples[0].elapsedSeconds,2)
    recovery.applyBitrate(8192);recovery.recordRetry(true)
    assert.equal(recovery.bitrateOverride,8192)
    recovery.applyBitrate(NaN);assert.equal(recovery.bitrateOverride,8192)
})
test('stale final stats cannot produce live quality advice',()=>{
    const samples=Array.from({length:20},(_,elapsedSeconds)=>({width:1920,height:1080,fps:60,rtt:180,jitter:40,loss:0,bitrate:10,statsFresh:true,elapsedSeconds}))
    assert.ok(recommendLowerBitrate(samples,20480))
    samples[19].statsFresh=false
    assert.equal(recommendLowerBitrate(samples,20480),null)
})

test('Classic stats recovery is opt-in, bounded, and limited to established console sessions',()=>{
    const recovery=new ClassicRecoveryBudget()
    const state={error:'stats',active:true,blocked:false}
    assert.equal(recovery.delay(true,false,state),null)
    recovery.markConnected()
    assert.equal(recovery.delay(false,false,state),null)
    assert.equal(recovery.delay(true,true,state),null)
    assert.equal(recovery.delay(true,false,{...state,blocked:true}),null)
    assert.equal(recovery.delay(true,false,state),3000)
    recovery.recordRetry(true)
    assert.equal(recovery.delay(true,false,state),8000)
    recovery.recordRetry(true)
    assert.equal(recovery.delay(true,false,state),null)
})
