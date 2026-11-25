import {test} from 'node:test'
import assert from 'node:assert/strict'
import {captureName,storeCapture} from '../../renderer/lib/capturelibrary'
test('capture names preserve the correct extension and reject unsafe filenames',()=>{assert.equal(captureName('  my game.webm ','screenshot'),'my game.png');assert.equal(captureName('my clip','clip'),'my clip.webm');for(const name of ['../file','a/b','a\\b','CON','NUL.png','..','', 'a'.repeat(81),null])assert.equal(captureName(name,'clip'),null)})
test('unsupported capture media is rejected before accessing storage',async()=>{await assert.rejects(storeCapture('screenshot',new Blob(['bad'],{type:'text/html'})));await assert.rejects(storeCapture('clip',new Blob(['bad'],{type:'image/png'})))})
