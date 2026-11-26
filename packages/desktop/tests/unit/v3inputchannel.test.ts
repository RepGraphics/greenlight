import {test} from 'node:test'
import assert from 'node:assert/strict'
import InputChannel from '../../../player/src/client/lib/channel/input'
import {ReportTypes,type InputFrame} from '../../../player/src/client/lib/channel/input/packet'

const frame:InputFrame={GamepadIndex:0,Nexus:0,Menu:0,View:0,A:1,B:0,X:0,Y:0,DPadUp:0,DPadDown:0,DPadLeft:0,DPadRight:0,LeftShoulder:0,RightShoulder:0,LeftThumb:0,RightThumb:0,LeftThumbXAxis:0,LeftThumbYAxis:0,RightThumbXAxis:0,RightThumbYAxis:0,LeftTrigger:0,RightTrigger:0}
function fixture(touchpoints=2){
    const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator')
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{maxTouchPoints:touchpoints}})
    const packets:DataView[]=[]
    const channel={readyState:'connecting',send:(data:DataView)=>packets.push(data),onopen:()=>{},onclose:()=>{}}
    let polls=0
    const player={consoleController:false,_peerConnection:{createDataChannel:()=>channel},_channels:{input:undefined as InputChannel|undefined,control:{getGamepadHandlers:()=>{polls++;return {}}}}}
    const input=new InputChannel(player as any)
    player._channels.input=input
    const all=()=>{
        input.queueMetadataFrame({serverDataKey:1,firstFramePacketArrivalTimeMs:0,frameSubmittedTimeMs:0,frameDecodedTimeMs:0,frameRenderedTimeMs:0})
        input.queueGamepadFrames([frame])
        input.queueMouseFrame({X:1,Y:0,WheelX:0,WheelY:0,Buttons:0,Relative:0})
        input.queueKeyboardFrame({pressed:true,keyCode:65,key:'a'})
        input.queuePointerFrame({events:[{type:'pointerdown',x:.5,y:.5,pressure:1}]})
    }
    const open=()=>{channel.readyState='open';channel.onopen()}
    const dispose=()=>{input.destroy();if(saved)Object.defineProperty(globalThis,'navigator',saved);else Reflect.deleteProperty(globalThis,'navigator')}
    return {input,channel,packets,all,open,dispose,polls:()=>polls}
}

test('input waits for both open data channel and handshake start',()=>{
    const f=fixture()
    try{
        f.all();assert.equal(f.packets.length,0)
        f.open();f.all();assert.equal(f.packets.length,0)
        f.input.gamepadStateLoop();assert.equal(f.polls(),0)
        f.input.start();f.input.start();assert.equal(f.packets.length,1)
        f.all()
        assert.deepEqual(f.packets.map(p=>p.getUint16(0,true)),[ReportTypes.ClientMetadata,ReportTypes.Metadata|ReportTypes.Gamepad,ReportTypes.Mouse,ReportTypes.Keyboard,ReportTypes.Pointer])
    }finally{f.dispose()}
})

test('handshake before channel open starts only after open',()=>{
    const f=fixture()
    try{
        f.input.start();f.all();assert.equal(f.packets.length,0)
        f.open();f.open();assert.equal(f.packets.length,1)
    }finally{f.dispose()}
})

test('closed or destroyed input channel cannot poll, send or restart',()=>{
    const f=fixture()
    try{
        f.open();f.input.start()
        f.channel.readyState='closed';f.channel.onclose()
        f.all();f.input.gamepadStateLoop();f.open();f.input.start();f.all()
        assert.equal(f.packets.length,1);assert.equal(f.polls(),0)
    }finally{f.dispose()}
})

test('touchpoint metadata remains encodable for unexpected browser capabilities',()=>{
    for(const [value,expected] of [[NaN,2],[-1,2],[3.9,3],[1000,255],[Infinity,2]]){
        const f=fixture(value)
        try{f.open();f.input.start();assert.equal(f.packets[0].getUint8(14),expected)}finally{f.dispose()}
    }
})
