import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createDiagnosticReport} from '../../renderer/lib/streamdiagnostics'
import {parseDiagnostics} from '../../renderer/lib/diagnosticsimport'
const sample={elapsedSeconds:1,width:1920,height:1080,fps:60,bitrate:12,jitter:3,loss:0,rtt:5,statsFresh:true}
test('Classic report round trips through viewer with failure reason',()=>{const report=createDiagnosticReport([sample],'home','Error','video',[],'closed','classic');const imported=parseDiagnostics(JSON.stringify(report));assert.equal(imported.engine,'classic');assert.equal(imported.attempts[0].reason,'closed');assert.equal(imported.attempts[0].samples[0].fps,60)})
test('V3 remains the default report format',()=>{const report=createDiagnosticReport([sample],'cloud','Connected','webgpu');assert.equal(report.engine,'v3');assert.equal(parseDiagnostics(JSON.stringify(report)).renderer,'webgpu')})
test('diagnostic exports bound samples and remove unrecognised properties',()=>{const report=createDiagnosticReport(Array.from({length:305},(_,i)=>({...sample,elapsedSeconds:i,ip:'private'})),'home','Connected','video');assert.equal(report.samples.length,300);assert.equal(report.samples[0].elapsedSeconds,5);assert.equal('ip' in report.samples[0],false)})
test('viewer rejects unsupported Classic schema and unknown engines',()=>{assert.throws(()=>parseDiagnostics(JSON.stringify({engine:'classic',schema:3,samples:[]})));assert.throws(()=>parseDiagnostics(JSON.stringify({engine:'other',schema:4,samples:[]})))})
