import {test} from 'node:test'
import assert from 'node:assert/strict'
import InputPacket,{ReportTypes,type InputFrame,type MetadataFrame,type MouseFrame,type KeyboardFrame,type PointerContact} from '../../../player/src/client/lib/channel/input/packet'

const keyboard:KeyboardFrame={pressed:true,keyCode:65,key:'a'}
const mouse:MouseFrame={X:1,Y:2,WheelX:0,WheelY:0,Buttons:0,Relative:1}
const metadata:MetadataFrame={serverDataKey:1,firstFramePacketArrivalTimeMs:2,frameSubmittedTimeMs:3,frameDecodedTimeMs:4,frameRenderedTimeMs:5}
const gamepad:InputFrame={GamepadIndex:0,Nexus:0,Menu:0,View:0,A:1,B:0,X:0,Y:0,DPadUp:0,DPadDown:0,DPadLeft:0,DPadRight:0,LeftShoulder:0,RightShoulder:0,LeftThumb:0,RightThumb:0,LeftThumbXAxis:0,LeftThumbYAxis:0,RightThumbXAxis:0,RightThumbYAxis:0,LeftTrigger:0,RightTrigger:0}
const contact:PointerContact={type:'pointerdown',x:.5,y:.5,pressure:1}

test('mixed input report serializes every section at its expected length',()=>{
    const packet=new InputPacket(42)
    packet.setStreamConfig({width:1920,height:1080})
    packet.setData([metadata],[gamepad],[{events:[contact]}],[mouse],[keyboard])
    const view=packet.toBuffer()
    assert.equal(view.byteLength,14+29+24+22+19+4)
    assert.equal(view.getUint16(0,true),ReportTypes.Metadata|ReportTypes.Gamepad|ReportTypes.Pointer|ReportTypes.Mouse|ReportTypes.Keyboard)
    assert.equal(view.getUint32(2,true),42)
    assert.equal(view.getUint8(14),1)
    assert.equal(view.getUint8(43),1)
    assert.equal(view.getUint8(67),1)
    assert.equal(view.getUint8(68),1)
    assert.equal(view.getUint8(89),1)
    assert.equal(view.getUint8(108),1)
    assert.equal(view.getUint8(111),65)
})

test('packet length guard rejects excess allocated bytes',()=>{
    const packet=new InputPacket(1)
    packet.setData([],[],[],[],[keyboard])
    packet._totalSize++
    assert.throws(()=>packet.toBuffer(),/Packet length mismatch/)
})

test('reusing a packet replaces prior flags and frames including client metadata',()=>{
    const packet=new InputPacket(1)
    packet.setData([metadata],[gamepad],[],[],[])
    packet.setData([],[],[],[],[keyboard])
    let view=packet.toBuffer()
    assert.equal(view.getUint16(0,true),ReportTypes.Keyboard)
    assert.equal(view.byteLength,18)
    packet.setMetadata(2)
    view=packet.toBuffer()
    assert.equal(view.getUint16(0,true),ReportTypes.ClientMetadata)
    assert.equal(view.byteLength,15)
    assert.equal(view.getUint8(14),2)
    packet.setData([],[],[],[],[])
    view=packet.toBuffer()
    assert.equal(view.getUint16(0,true),ReportTypes.None)
    assert.equal(view.byteLength,14)
})

test('single-byte report counts cannot silently wrap',()=>{
    const packet=new InputPacket(1)
    const many=<T>(frame:T)=>Array<T>(256).fill(frame)
    assert.throws(()=>packet.setData(many(metadata),[],[],[],[]),RangeError)
    assert.throws(()=>packet.setData([],many(gamepad),[],[],[]),RangeError)
    assert.throws(()=>packet.setData([],[],[],many(mouse),[]),RangeError)
    assert.throws(()=>packet.setData([],[],[],[],many(keyboard)),RangeError)
    assert.throws(()=>packet.setData([],[],[{events:many(contact).slice(0,200)},{events:many(contact).slice(0,56)}],[],[]),RangeError)
    for(const invalid of [-1,256,1.5,NaN,Infinity])assert.throws(()=>packet.setMetadata(invalid),RangeError)
    packet.setData([],[],[],[],many(keyboard).slice(0,255))
    assert.equal(packet.toBuffer().getUint8(14),255)
    packet.setMetadata(255)
    assert.equal(packet.toBuffer().getUint8(14),255)
})
