import {test} from 'node:test'
import assert from 'node:assert/strict'
import {microsoftDeviceLogin,readDeviceLogin,remainingDeviceLoginSeconds} from '../../../desktop-v3/renderer/utils/devicelogin'
const flow={user_code:'ABCD-EFGH',device_code:'opaque-device-code',expires_in:900}
test('device login presentation excludes untrusted response text and destinations',()=>{
    assert.deepEqual(readDeviceLogin({...flow,verification_uri:'https://evil.invalid',message:'Visit evil.invalid'}),{userCode:'ABCD-EFGH',deviceCode:'opaque-device-code',expiresIn:900})
    assert.equal(microsoftDeviceLogin,'https://microsoft.com/devicelogin')
})
test('invalid and oversized device-code responses are rejected',()=>{
    for(const value of [null,[],{}, {...flow,user_code:'<script>'},{...flow,user_code:'x'.repeat(33)},{...flow,device_code:''},{...flow,device_code:'a b'},{...flow,device_code:'x'.repeat(8193)},{...flow,expires_in:0},{...flow,expires_in:3601},{...flow,expires_in:'900'}])assert.equal(readDeviceLogin(value),null)
})
test('missing expiry uses a bounded fallback while a supplied valid expiry is retained',()=>{
    assert.equal(readDeviceLogin({...flow,expires_in:undefined})?.expiresIn,900)
    assert.equal(readDeviceLogin({...flow,expires_in:30})?.expiresIn,30)
})
test('countdown uses the elapsed clock, not the number of interval ticks',()=>{
    assert.equal(remainingDeviceLoginSeconds(10000,1000),9)
    assert.equal(remainingDeviceLoginSeconds(10000,9500),1)
    assert.equal(remainingDeviceLoginSeconds(10000,20000),0)
    assert.equal(remainingDeviceLoginSeconds(Infinity,0),0)
})
