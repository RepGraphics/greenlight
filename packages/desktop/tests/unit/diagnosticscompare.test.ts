import {test} from 'node:test'
import assert from 'node:assert/strict'
import {compareDiagnostics} from '../../renderer/lib/diagnosticscompare'
import {createDiagnosticReport} from '../../renderer/lib/streamdiagnostics'
import {parseDiagnostics} from '../../renderer/lib/diagnosticsimport'
const sample={elapsedSeconds:1,width:1920,height:1080,fps:60,bitrate:12,jitter:3,loss:0,rtt:5,statsFresh:true}
test('diagnostic comparison calculates signed differences without inventing absent metrics',()=>{const comparison=compareDiagnostics([sample],[{...sample,fps:30,rtt:20,bitrate:0}]);assert.deepEqual(comparison.metrics.map(m=>m.delta),[-30,null,15,0]);assert.equal(compareDiagnostics([],[sample]).metrics.every(m=>m.delta===null),true)})
test('diagnostic comparison ignores stale statistics',()=>{assert.ok(compareDiagnostics([sample],[{...sample,statsFresh:false}]).metrics.every(m=>m.delta===null))})
test('previous diagnostic attempts are bounded and sanitized on export',()=>{const attempts=Array.from({length:5},()=>({state:'Error',reason:'media',samples:Array.from({length:301},(_,i)=>({...sample,elapsedSeconds:i,token:'secret'}))}));const report=createDiagnosticReport([sample],'home','Connected','video',attempts);assert.equal(report.previousAttempts.length,3);assert.equal(report.previousAttempts[0].samples.length,300);assert.equal('token' in report.previousAttempts[0].samples[0],false);assert.equal(parseDiagnostics(JSON.stringify(report)).attempts.length,4)})
test('diagnostic import rejects nonnumeric schemas and over-limit UTF-8 data',()=>{assert.throws(()=>parseDiagnostics(JSON.stringify({engine:'v3',schema:'4',samples:[]})));assert.throws(()=>parseDiagnostics(JSON.stringify({engine:'v3',schema:4,samples:[],extra:'€'.repeat(800000)})),/too large/)})
