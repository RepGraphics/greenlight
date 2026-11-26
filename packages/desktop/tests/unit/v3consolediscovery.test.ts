import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeConsoles,searchConsoles,consoleReady} from '../../../desktop-v3/renderer/utils/consoles'
const ready={id:'one',name:'Bedroom Xbox',powerState:'ConnectedStandby',remoteManagementEnabled:true,consoleStreamingEnabled:true}
test('V3 console discovery accepts the existing Xbox response shape and only exposes required fields',()=>{
    const result=normalizeConsoles({data:{result:[{...ready,secret:'ignored'},null,{...ready,name:'duplicate'},{id:'two',remoteManagementEnabled:'true',consoleStreamingEnabled:true},{id:''}]}})
    assert.deepEqual(result,[ready,{id:'two',name:'Xbox console',powerState:'Unknown',remoteManagementEnabled:false,consoleStreamingEnabled:true}])
    assert.equal(consoleReady(result[0]),true);assert.equal(consoleReady(result[1]),false)
})
test('malformed discovery is distinct from a valid empty account',()=>{
    for(const value of [null,{}, {data:{result:{}}},{data:{result:null}}])assert.throws(()=>normalizeConsoles(value))
    assert.deepEqual(normalizeConsoles({data:{result:[]}}),[])
})
test('console search is case-insensitive and prioritizes remote-play-ready devices without mutating the source',()=>{
    const items=normalizeConsoles({data:{result:[{id:'two',name:'Attic Xbox'},ready,{id:'three',name:'Office',remoteManagementEnabled:true,consoleStreamingEnabled:true}]}})
    assert.deepEqual(searchConsoles(items,' XBOX ').map(item=>item.id),['one','two'])
    assert.deepEqual(searchConsoles(items,'').map(item=>item.id),['one','three','two'])
    assert.deepEqual(items.map(item=>item.id),['two','one','three'])
})
