import {test} from 'node:test'
import assert from 'node:assert/strict'
import {appendGraphSample,graphData} from '../../renderer/lib/networkgraph'
const sample=(elapsedSeconds:number,statsFresh=true)=>({elapsedSeconds,width:1920,height:1080,fps:60,bitrate:10,rtt:30,jitter:3,loss:0,statsFresh})
test('network graph history remains bounded to 300 samples and five minutes',()=>{
    let samples:ReturnType<typeof sample>[]=[]
    for(let i=0;i<600;i++)samples=appendGraphSample(samples,sample(i))
    assert.equal(samples.length,300)
    assert.equal(samples[0].elapsedSeconds,300)
    assert.equal(samples.at(-1)?.elapsedSeconds,599)
    samples=appendGraphSample(samples,sample(1000))
    assert.deepEqual(samples,[sample(1000)])
})
test('graph history handles clock reset and duplicate timestamps without mutation',()=>{
    const previous=[sample(1),sample(2)]
    assert.deepEqual(appendGraphSample(previous,sample(0)),[sample(0)])
    assert.deepEqual(appendGraphSample(previous,sample(2,false)),[sample(1),sample(2,false)])
    assert.deepEqual(previous,[sample(1),sample(2)])
    assert.equal(appendGraphSample(previous,sample(NaN)),previous)
})
test('unavailable samples remain visible as graph gaps rather than fabricated zeroes',()=>{
    let samples=[sample(0)]
    for(const value of [sample(1,false),sample(2),sample(3)])samples=appendGraphSample(samples,value)
    const graph=graphData(samples,'rtt',30)
    assert.equal(graph.segments.length,2)
    assert.equal(graph.last,30)
    assert.equal(graphData(appendGraphSample(samples,sample(4,false)),'rtt',30).last,undefined)
})

test('graph snapshots isolate producer mutation and break lines across missing intervals',()=>{
    const source=sample(1)
    let history=appendGraphSample([],source)
    source.rtt=999
    history=appendGraphSample(history,sample(7))
    assert.equal(history[0].rtt,30)
    assert.equal(graphData(history,'rtt',30).segments.length,2)
})
