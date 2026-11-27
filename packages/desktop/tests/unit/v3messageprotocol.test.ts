import {test} from 'node:test'
import assert from 'node:assert/strict'
import {decodeStreamMessage,decodeMessageDialog,messageLimit} from '../../../player/src/client/lib/channel/message/protocol'
import MessageHandler from '../../../player/src/client/lib/channel/message/handler'

const target='/streaming/systemUi/messages/ShowMessageDialog'
const disconnect='/streaming/sessionLifetimeManagement/serverInitiatedDisconnect'
const transaction=(content:unknown,route=target)=>({type:'TransactionStart' as const,id:'id-1',target:route,content})
const dialog=JSON.stringify({TitleText:'Confirm',ContentText:'Continue?'})
test('message envelopes accept supported JSON strings and bounded binary views',()=>{
    assert.deepEqual(decodeStreamMessage('{"type":"HandshakeAck"}'),{type:'HandshakeAck'})
    const value=transaction(dialog)
    const bytes=new TextEncoder().encode(JSON.stringify(value))
    assert.deepEqual(decodeStreamMessage(JSON.stringify(value)),value)
    assert.deepEqual(decodeStreamMessage(bytes.buffer),value)
    const padded=new Uint8Array(bytes.length+4);padded.set(bytes,2)
    assert.deepEqual(decodeStreamMessage(padded.subarray(2,2+bytes.length)),value)
})
test('malformed, oversized or unrecognized envelopes are ignored',()=>{
    for(const value of [undefined,null,{},new Uint8Array([255]),new Uint8Array(messageLimit+1),'x'.repeat(messageLimit+1),'[]','null','{','{"type":"unknown"}',JSON.stringify({...transaction(dialog),id:''}),JSON.stringify({...transaction(dialog),id:'bad\n'}),JSON.stringify({...transaction(dialog),id:2}),JSON.stringify({...transaction(dialog),target:7}),JSON.stringify({...transaction(dialog),target:'x'.repeat(257)})]){
        assert.equal(decodeStreamMessage(value),undefined)
    }
})
test('dialog parsing accepts only bounded string fields',()=>{
    assert.deepEqual(decodeMessageDialog(dialog),{title:'Confirm',body:'Continue?'})
    for(const value of [undefined,null,{},'null','[]','{','{}',JSON.stringify({TitleText:7,ContentText:'ok'}),JSON.stringify({TitleText:'x'.repeat(513),ContentText:'ok'}),JSON.stringify({TitleText:'ok',ContentText:'x'.repeat(8193)})]){
        assert.equal(decodeMessageDialog(value),undefined)
    }
})
function fixture(){
    const sent:string[]=[]
    const player={serverDisconnected:false}
    const channel={send:(data:string)=>sent.push(data),getPlayer:()=>player} as unknown as ConstructorParameters<typeof MessageHandler>[0]
    return {channel,sent,player}
}
test('valid dialog results preserve the existing transaction wire format',()=>{
    for(const accepted of [true,false]){
        const f=fixture()
        new MessageHandler(f.channel,transaction(dialog),text=>{assert.equal(text,'Confirm\n\nContinue?');return accepted})
        assert.deepEqual(JSON.parse(f.sent[0]),{type:'TransactionComplete',content:JSON.stringify({Result:accepted?0:1}),id:'id-1',cv:''})
    }
})
test('malformed dialogs never prompt and unavailable dialogs decline safely',()=>{
    const f=fixture()
    new MessageHandler(f.channel,transaction('{'),()=>assert.fail('invalid dialog prompted'))
    new MessageHandler(f.channel,transaction(dialog),()=>{throw Error('blocked browser dialog')})
    assert.equal(f.sent.length,2)
    for(const message of f.sent)assert.equal(JSON.parse(JSON.parse(message).content).Result,1)
})
test('server disconnect remains acknowledged and unknown targets do nothing',()=>{
    const f=fixture()
    new MessageHandler(f.channel,transaction(undefined,disconnect),()=>assert.fail('unexpected prompt'))
    assert.equal(f.player.serverDisconnected,true)
    assert.deepEqual(JSON.parse(f.sent[0]),{type:'TransactionComplete',content:'""',id:'id-1',cv:''})
    new MessageHandler(f.channel,transaction(dialog,'/unknown'),()=>assert.fail('unexpected prompt'))
    assert.equal(f.sent.length,1)
})
