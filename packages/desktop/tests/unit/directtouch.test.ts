import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizedTouchPoint} from '../../../player/src/client/lib/input/touchcoordinates'
import InputPacket,{ReportTypes} from '../../../player/src/client/lib/channel/input/packet'
const rect={left:10,top:20,width:200,height:200}
test('direct touch excludes letterbox starts and maps video center',()=>{
    assert.equal(normalizedTouchPoint(110,25,rect,1920,1080,'contain',true),null)
    assert.deepEqual(normalizedTouchPoint(110,120,rect,1920,1080,'contain',true),{x:0.5,y:0.5})
    assert.deepEqual(normalizedTouchPoint(-100,1000,rect,1920,1080,'contain',false),{x:0,y:1})
    assert.equal(normalizedTouchPoint(110,120,rect,0,1080,'contain',true),null)
})
test('direct touch maps cropped cover and stretched display independently',()=>{
    assert.deepEqual(normalizedTouchPoint(10,120,rect,400,200,'cover',true),{x:0.25,y:0.5})
    assert.deepEqual(normalizedTouchPoint(10,220,rect,400,200,'fill',true),{x:0,y:1})
})
test('native pointer packet clamps coordinates, preserves contact ID and emits release',()=>{
    const packet=new InputPacket(1)
    packet.setStreamConfig({width:1920,height:1080})
    packet.setData([],[],[{events:[{type:'pointerdown',x:-0.1,y:1.2,pressure:1},{type:'pointerup',x:0.5,y:0.5,pressure:1}]}],[],[])
    const view=packet.toBuffer()
    assert.equal(view.getUint16(0,true),ReportTypes.Pointer);assert.equal(view.byteLength,56)
    assert.equal(view.getUint8(14),1);assert.equal(view.getUint8(15),2)
    assert.equal(view.getUint32(23,true),0);assert.equal(view.getUint32(27,true),0);assert.equal(view.getUint32(31,true),1079);assert.equal(view.getUint8(35),1)
    assert.equal(view.getUint8(40),0);assert.equal(view.getUint32(47,true),0);assert.equal(view.getUint32(51,true),0);assert.equal(view.getUint8(55),2)
})
