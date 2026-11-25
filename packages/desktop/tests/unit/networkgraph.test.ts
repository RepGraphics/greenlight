import {test} from 'node:test'
import assert from 'node:assert/strict'
import {graphData} from '../../renderer/lib/networkgraph'
import {recommendLowerBitrate,recoveryBitrate} from '../../renderer/lib/bitrateadvisor'
import {MediaStallMonitor} from '../../../player/src/client/lib/mediastall'
const sample=(elapsedSeconds:number,statsFresh=true)=>({elapsedSeconds,width:1920,height:1080,fps:60,bitrate:20,jitter:40,loss:0,rtt:200,statsFresh})
test('graphs split at stale data and missing time intervals',()=>{const graph=graphData([sample(0),sample(1),sample(2,false),sample(3),sample(4),sample(9),sample(10)],'rtt',60);assert.equal(graph.segments.length,3);assert.equal(graph.last,200)})
test('graph windows exclude older values and do not display stale current values',()=>{const graph=graphData([{...sample(0),rtt:999},sample(60),sample(61,false)],'rtt',30);assert.equal(graph.max,200);assert.equal(graph.last,undefined);assert.equal(graphData([],'fps',60).segments.length,0)})
test('quality advice rejects widely separated or duplicate samples',()=>{assert.equal(recommendLowerBitrate(Array.from({length:20},(_,i)=>sample(i*5)),20480),null);assert.equal(recommendLowerBitrate(Array.from({length:20},(_,i)=>sample(Math.floor(i/2))),20480),null)})
test('adaptive recovery ignores stale historical congestion',()=>{const samples=Array.from({length:20},(_,i)=>sample(i));samples.push(sample(45,false));assert.equal(recoveryBitrate(samples,20480,'media',true),null)})
test('media watchdog resets after background or sampling interruption',()=>{const monitor=new MediaStallMonitor();monitor.sample(0,[{id:'v',bytes:10}],true);for(let t=1000;t<14000;t+=1000)monitor.sample(t,[{id:'v',bytes:10}],true);assert.equal(monitor.sample(14000,[],false),false);assert.equal(monitor.sample(30000,[{id:'v',bytes:10}],true),false);assert.equal(monitor.sample(46000,[{id:'v',bytes:10}],true),false)})
