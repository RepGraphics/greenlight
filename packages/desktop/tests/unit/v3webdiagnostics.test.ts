import {test} from 'node:test'
import assert from 'node:assert/strict'
import {appendWebDiagnostic,webDiagnosticReport} from '../../../desktop-v3/renderer/utils/webdiagnostics'
import {parseDiagnostics} from '../../renderer/lib/diagnosticsimport'
import {graphData} from '../../renderer/lib/networkgraph'
import type {DiagnosticSample} from '../../renderer/lib/streamdiagnostics'

const metrics={width:1920,height:1080,fps:60,bitrate:12,jitter:4,loss:2,rtt:35,statsFresh:true,statsAgeMs:100,peerState:'connected',iceState:'completed',signalingState:'stable'}
test('web diagnostics retain at most 300 samples and five minutes of history',()=>{
    let samples:DiagnosticSample[]=[]
    for(let time=0;time<=400;time++)samples=appendWebDiagnostic(samples,metrics,time)
    assert.equal(samples.length,300)
    assert.equal(samples[0].elapsedSeconds,101)
    assert.equal(samples.at(-1)?.elapsedSeconds,400)
    samples=appendWebDiagnostic(samples,metrics,800)
    assert.equal(samples.length,1)
})
test('invalid clocks are ignored and a new elapsed clock resets the history',()=>{
    const samples=appendWebDiagnostic([],metrics,10)
    for(const elapsed of [-1,NaN,Infinity])assert.equal(appendWebDiagnostic(samples,metrics,elapsed),samples)
    assert.equal(appendWebDiagnostic(samples,metrics,0).length,1)
    assert.equal(appendWebDiagnostic(samples,metrics,0)[0].elapsedSeconds,0)
    assert.equal(appendWebDiagnostic(samples,{...metrics,fps:30},10)[0].fps,30)
})
test('diagnostics allowlist numerical data and connection states',()=>{
    const unsafe={...metrics,width:Infinity,bitrate:1e308,jitter:-2,peerState:'secret',iceState:'secret',signalingState:'secret',token:'secret',remoteAddress:'secret'}
    const samples=appendWebDiagnostic([],unsafe,0)
    assert.equal(samples[0].width,0)
    assert.equal(samples[0].bitrate,10000)
    assert.equal(samples[0].jitter,0)
    const report=webDiagnosticReport(samples,'home','secret','secret')
    assert.equal(report.state,'Unknown');assert.equal(report.failureReason,'')
    assert.equal(JSON.stringify(report).includes('secret'),false)
})
test('stale or unknown freshness creates graph gaps instead of valid measurements',()=>{
    let samples=appendWebDiagnostic([],metrics,0)
    samples=appendWebDiagnostic(samples,{...metrics,statsFresh:false},1)
    samples=appendWebDiagnostic(samples,{...metrics,statsFresh:undefined},2)
    samples=appendWebDiagnostic(samples,metrics,3)
    const graph=graphData(samples,'rtt',30)
    assert.equal(graph.segments.length,2)
    assert.equal(webDiagnosticReport(samples,'cloud','Connected','').summary.sampleCount,2)
})
test('web report round-trips through the desktop diagnostic importer',()=>{
    const samples=Array.from({length:6}).reduce<DiagnosticSample[]>((current,_,i)=>appendWebDiagnostic(current,metrics,i),[])
    const report=webDiagnosticReport(samples,'cloud','Error','transport')
    assert.equal(report.schema,4)
    assert.equal(report.summary.quality,'good')
    const parsed=parseDiagnostics(JSON.stringify(report))
    assert.equal(parsed.engine,'v3')
    assert.equal(parsed.type,'cloud')
    assert.equal(parsed.attempts[0].reason,'transport')
    assert.equal(parsed.attempts[0].samples.length,6)
})
