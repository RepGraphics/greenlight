import {test} from 'node:test'
import assert from 'node:assert/strict'
import {filterCaptures} from '../../renderer/lib/capturelibrary'
import type {CaptureInfo} from '../../renderer/lib/capturelibrary'
const entries:CaptureInfo[]=[{id:'a',kind:'clip',name:'Racing.webm',createdAt:2,size:30},{id:'b',kind:'screenshot',name:'Racing.png',createdAt:1,size:4},{id:'c',kind:'clip',name:'Adventure.webm',createdAt:3,size:20}]
test('capture search combines kind and case-insensitive filename',()=>{assert.deepEqual(filterCaptures(entries,'clip',' RACING ','newest').map(x=>x.id),['a']);assert.deepEqual(filterCaptures(entries,'all','missing','name'),[])})
test('capture sorting supports dates, size and name without mutating stored records',()=>{assert.deepEqual(filterCaptures(entries,'all','','newest').map(x=>x.id),['c','a','b']);assert.deepEqual(filterCaptures(entries,'all','','oldest').map(x=>x.id),['b','a','c']);assert.deepEqual(filterCaptures(entries,'all','','largest').map(x=>x.id),['a','c','b']);assert.deepEqual(filterCaptures(entries,'all','', 'name').map(x=>x.id),['c','b','a']);assert.deepEqual(entries.map(x=>x.id),['a','b','c'])})
