import {test} from 'node:test'
import assert from 'node:assert/strict'
import {webMicrophoneSupported,microphoneRequested,toggleWebMicrophone,webMicrophoneResult} from '../../../desktop-v3/renderer/utils/microphoneoptions'

test('microphone requires a secure context and the capture API',()=>{
    const media={getUserMedia:()=>{}}
    assert.equal(webMicrophoneSupported(true,media),true)
    assert.equal(webMicrophoneSupported(false,media),false)
    assert.equal(webMicrophoneSupported(true),false)
    assert.equal(webMicrophoneSupported(true,{getUserMedia:true}),false)
})
test('microphone starts off and can only be explicitly enabled while connected',()=>{
    assert.equal(microphoneRequested('off'),false)
    assert.equal(microphoneRequested('failed'),false)
    assert.equal(toggleWebMicrophone('off',true,false),'off')
    assert.equal(toggleWebMicrophone('off',false,true),'off')
    assert.equal(toggleWebMicrophone('off',true,true),'requesting')
    assert.equal(microphoneRequested('requesting'),true)
})
test('a microphone request can be cancelled before permission or signaling completes',()=>{
    assert.equal(toggleWebMicrophone('requesting',true,true),'off')
    assert.equal(webMicrophoneResult('off',true),'off')
    assert.equal(webMicrophoneResult('off',false,true),'off')
    assert.equal(microphoneRequested('off'),false)
})
test('active microphone status follows acknowledged capture and can be disabled',()=>{
    assert.equal(webMicrophoneResult('requesting',true),'active')
    assert.equal(microphoneRequested('active'),true)
    assert.equal(toggleWebMicrophone('active',true,true),'off')
    assert.equal(toggleWebMicrophone('active',false,false),'off')
})
test('failed permission, negotiation or ended capture requires a new explicit request',()=>{
    assert.equal(webMicrophoneResult('requesting',false,true),'failed')
    assert.equal(webMicrophoneResult('requesting',false),'failed')
    assert.equal(webMicrophoneResult('active',false,true),'failed')
    assert.equal(webMicrophoneResult('failed',true),'failed')
    assert.equal(toggleWebMicrophone('failed',true,true),'requesting')
    assert.equal(toggleWebMicrophone('failed',true,false),'off')
})
