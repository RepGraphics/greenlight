import {test} from 'node:test'
import assert from 'node:assert/strict'
import MessageChannel from '../../../player/src/client/lib/channel/message'
import Touch from '../../../player/src/client/lib/input/touch'
function fixture(){
    const sent:any[]=[]
    const transport={readyState:'open',send(data:Uint8Array){sent.push(JSON.parse(new TextDecoder().decode(data)))}}
    const player:any={consoleController:false,_peerConnection:{createDataChannel:()=>transport},_channels:{control:{sendAuthorization(){}},input:{start(){}}}}
    const message=new MessageChannel(player);player._channels.message=message
    const handshake=()=>message.onMessage({data:JSON.stringify({type:'HandshakeAck'})} as MessageEvent)
    const states=()=>sent.filter(item=>item.target==='/streaming/characteristics/touchinputenabledchanged').map(item=>JSON.parse(item.content).touchInputEnabled)
    return {player,message,transport,handshake,states}
}
test('direct touch capability follows handshake and mode changes without duplicate messages',()=>{
    const f=fixture()
    f.message.setTouchInputEnabled(true);assert.deepEqual(f.states(),[])
    f.handshake();assert.deepEqual(f.states(),[true])
    f.message.setTouchInputEnabled(true);f.handshake();assert.deepEqual(f.states(),[true])
    f.message.setTouchInputEnabled(false);assert.deepEqual(f.states(),[true,false])
    f.message.setTouchInputEnabled(true);assert.deepEqual(f.states(),[true,false,true])
    f.message.destroy();f.message.setTouchInputEnabled(false);f.handshake()
    assert.deepEqual(f.states(),[true,false,true])
})
test('new sessions advertise touch disabled and console-paired mode takes precedence',()=>{
    const f=fixture();f.handshake();assert.deepEqual(f.states(),[false])
    const g=fixture();g.player.consoleController=true;g.message.setTouchInputEnabled(true);g.handshake()
    assert.deepEqual(g.states(),[false])
})
test('touch driver advertises capability only while attached to an eligible video',()=>{
    const saved=['window','document'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const)
    const eventTarget={addEventListener(){},removeEventListener(){}}
    Object.defineProperty(globalThis,'window',{configurable:true,value:eventTarget})
    Object.defineProperty(globalThis,'document',{configurable:true,value:eventTarget})
    const f=fixture();f.handshake()
    const surface={...eventTarget,tagName:'VIDEO',isConnected:true,style:{touchAction:'auto'}}
    f.player.getVideoElement=()=>surface
    const touch=new Touch()
    try{
        touch.attach(f.player);assert.deepEqual(f.states(),[false,true]);assert.equal(surface.style.touchAction,'none')
        touch.detach();touch.detach();assert.deepEqual(f.states(),[false,true,false]);assert.equal(surface.style.touchAction,'auto')
        surface.isConnected=false;touch.attach(f.player)
        surface.isConnected=true;f.player.consoleController=true;touch.attach(f.player)
        assert.deepEqual(f.states(),[false,true,false])
    }finally{touch.detach();for(const [name,d] of saved){if(d)Object.defineProperty(globalThis,name,d);else Reflect.deleteProperty(globalThis,name)}}
})
