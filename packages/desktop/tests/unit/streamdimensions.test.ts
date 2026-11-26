import {test} from 'node:test'
import assert from 'node:assert/strict'
import {streamDimensions} from '../../../player/src/client/lib/channel/message/dimensions'
import MessageChannel from '../../../player/src/client/lib/channel/message'

test('V3 advertises consistent 720p and 1080p dimensions and safe areas',()=>{
    assert.deepEqual(streamDimensions(720),{horizontal:1280,vertical:720,preferredWidth:1280,preferredHeight:720,safeAreaLeft:0,safeAreaTop:0,safeAreaRight:1280,safeAreaBottom:720,supportsCustomResolution:true})
    assert.deepEqual(streamDimensions(1080),{horizontal:1920,vertical:1080,preferredWidth:1920,preferredHeight:1080,safeAreaLeft:0,safeAreaTop:0,safeAreaRight:1920,safeAreaBottom:1080,supportsCustomResolution:true})
})
test('unsupported or absent preferences preserve the existing 1080p default',()=>{
    for(const value of [undefined,null,0,1440,NaN,'720'])assert.deepEqual(streamDimensions(value),streamDimensions(1080))
})
test('V3 message handshake sends each session resolution without leaking a previous preference',()=>{
    for(const resolution of [720,1080,undefined]){
        const sent:any[]=[]
        const transport={readyState:'open',send(data:Uint8Array){sent.push(JSON.parse(new TextDecoder().decode(data)))}}
        const player={requestedResolution:resolution,consoleController:false,_peerConnection:{createDataChannel:()=>transport},_channels:{control:{sendAuthorization(){}},input:{start(){}}}}
        const channel=new MessageChannel(player as any)
        channel.onMessage({data:JSON.stringify({type:'HandshakeAck'})} as MessageEvent)
        channel.onMessage({data:JSON.stringify({type:'HandshakeAck'})} as MessageEvent)
        const messages=sent.filter(item=>item.target==='/streaming/characteristics/dimensionschanged')
        assert.equal(messages.length,1)
        assert.deepEqual(JSON.parse(messages[0].content),streamDimensions(resolution))
    }
})
