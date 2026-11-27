import {test} from 'node:test'
import assert from 'node:assert/strict'
import {webQualityAdvice} from '../../../desktop-v3/renderer/utils/webqualityadvice'

const history=()=>Array.from({length:20},(_,i)=>({elapsedSeconds:i,width:1920,height:1080,fps:60,bitrate:20,jitter:45,loss:0,rtt:200,statsFresh:true}))
test('sustained recent congestion recommends a supported lower next-session cap',()=>{
    assert.equal(webQualityAdvice(history(),20480,20,'Connected'),10240)
    assert.equal(webQualityAdvice(history(),0,20,'Connected'),10240)
    assert.equal(webQualityAdvice(history(),8192,20,'Connected'),6144)
})
test('stale, future, missing and invalid measurements cannot recommend a downgrade',()=>{
    const data=history()
    for(const now of [18,25,NaN,Infinity])assert.equal(webQualityAdvice(data,20480,now,'Connected'),null)
    assert.equal(webQualityAdvice([],20480,20,'Connected'),null)
    assert.equal(webQualityAdvice(data.map(s=>({...s,statsFresh:false})),20480,20,'Connected'),null)
})
test('recommendation requires an active connection and a valid configured cap',()=>{
    for(const state of ['Error','Provisioning','Reconnecting','Stopping'])assert.equal(webQualityAdvice(history(),20480,20,state),null)
    for(const cap of [-1,1023,NaN,Infinity,41984])assert.equal(webQualityAdvice(history(),cap,20,'Connected'),null)
})
test('isolated spikes and cleared congestion do not advise reducing quality',()=>{
    const data=history().map((s,i)=>({...s,rtt:i===2||i===12?200:40,jitter:5}))
    assert.equal(webQualityAdvice(data,20480,20,'Connected'),null)
    assert.equal(webQualityAdvice(history().map((s,i)=>i<10?s:{...s,rtt:40,jitter:5}),20480,20,'Connected'),null)
})
test('minimum cap is never raised and insufficient history is ignored',()=>{
    assert.equal(webQualityAdvice(history(),1024,20,'Connected'),null)
    assert.equal(webQualityAdvice(history().slice(-10),20480,20,'Connected'),null)
})
