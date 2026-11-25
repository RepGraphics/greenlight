import {test} from 'node:test'
import assert from 'node:assert/strict'
import {StreamAwake} from '../../main/helpers/streamawake'
import {portableSettings} from '../../renderer/lib/settingsbackup'
function fixture(duration=45000){let next=0;const active=new Set<number>();const lease=new StreamAwake({start:type=>{assert.equal(type,'prevent-display-sleep');active.add(++next);return next},stop:id=>{active.delete(id)},isStarted:id=>active.has(id)},duration);return {lease,active}}
test('awake lease is renewed without duplicating blockers',()=>{const {lease,active}=fixture();try{assert.equal(lease.renew(''),false);assert.equal(lease.renew('session'),true);lease.renew('session');assert.deepEqual([...active],[1]);lease.release('other');assert.equal(active.size,1);lease.release('session');assert.equal(active.size,0)}finally{lease.release()}})
test('switching session releases the previous blocker',()=>{const {lease,active}=fixture();try{lease.renew('a');lease.renew('b');assert.deepEqual([...active],[2]);lease.release('a');assert.deepEqual([...active],[2])}finally{lease.release()}})
test('orphaned awake lease expires automatically',async()=>{const {lease,active}=fixture(10);try{lease.renew('session');await new Promise(resolve=>setTimeout(resolve,40));assert.equal(active.size,0)}finally{lease.release()}})
test('keep awake preferences accept only booleans',()=>{assert.equal(portableSettings({stream_keep_awake:true}).stream_keep_awake,true);assert.equal(portableSettings({stream_keep_awake:'true'}).stream_keep_awake,undefined)})
