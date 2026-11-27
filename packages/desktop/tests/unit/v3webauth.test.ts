import {test} from 'node:test'
import assert from 'node:assert/strict'
import {AuthAttempt,clearLegacyUserToken} from '../../../desktop-v3/renderer/contexts/authattempt'
import {deviceSignInUrl,isDeviceSignInUrl} from '../../../desktop-v3/shared/devicesignin'
import {isRpcPath,rpcRequestAllowed,rpcHeaders} from '../../../pages/src/rpcpolicy'

test('superseding device authorization aborts the old generation and ignores late results',()=>{
    const owner=new AuthAttempt(),first=owner.begin(),second=owner.begin()
    assert.equal(first.signal.aborted,true);assert.equal(first.current(),false)
    assert.equal(second.current(),true)
    owner.cancel();owner.cancel()
    assert.equal(second.signal.aborted,true);assert.equal(second.current(),false)
    assert.equal(owner.begin().current(),true)
})
test('legacy browser token is deleted without reading or persisting credentials',()=>{
    const removed:string[]=[]
    clearLegacyUserToken(()=>({removeItem:key=>removed.push(key)}))
    assert.deepEqual(removed,['userToken'])
    assert.doesNotThrow(()=>clearLegacyUserToken(()=>{throw Error('Storage disabled')}))
})
test('device sign-in opens only the supported Microsoft pages with no code in the URL',()=>{
    const standard='https://microsoft.com/devicelogin',xbox='https://www.microsoft.com/link'
    assert.equal(deviceSignInUrl('https://www.microsoft.com/devicelogin'),standard)
    assert.equal(deviceSignInUrl('https://microsoft.com/link/'),xbox)
    assert.equal(isDeviceSignInUrl(standard),true)
    assert.equal(isDeviceSignInUrl(xbox),true)
    for(const url of [
        'https://microsoft.com.evil.test/link', 'http://www.microsoft.com/link',
        'https://www.microsoft.com:444/link', 'https://example@www.microsoft.com/link',
        'https://www.microsoft.com/link?otc=CODE', 'https://www.microsoft.com/link#CODE',
    ]){
        assert.equal(deviceSignInUrl(url),standard)
        assert.equal(isDeviceSignInUrl(url),false)
    }
})
test('web RPC requires POST with only the supported batch query marker',()=>{
    assert.equal(isRpcPath('/trpc/auth_msal_verify'),true)
    assert.equal(isRpcPath('/trpc'),true)
    assert.equal(isRpcPath('/trpc-extra'),false)
    assert.equal(rpcRequestAllowed('POST',''),true)
    assert.equal(rpcRequestAllowed('POST','?batch=1'),true)
    for(const method of ['GET','HEAD','OPTIONS'])assert.equal(rpcRequestAllowed(method,''),false)
    for(const query of ['?input=secret','?batch=1&input=secret','?token=secret'])assert.equal(rpcRequestAllowed('POST',query),false)
    assert.equal(rpcHeaders['Cache-Control'],'no-store')
})

import {deviceCodeDetails,deviceCodeRemaining} from '../../../desktop-v3/shared/devicesignin'
test('device prompts validate public fields, secrets and bounded expiry independently',()=>{
    const flow={user_code:'CODE-123',verification_uri:'https://www.microsoft.com/link',expires_in:30}
    assert.deepEqual(deviceCodeDetails(flow,false),{...flow,device_code:undefined})
    assert.equal(deviceCodeDetails(flow,true),null)
    assert.equal(deviceCodeDetails({...flow,device_code:'private-code'},true)?.device_code,'private-code')
    assert.equal(deviceCodeDetails({...flow,verification_uri:'https://evil.invalid'},false)?.verification_uri,'https://microsoft.com/devicelogin')
    for(const expires_in of [0,-1,3601,NaN,'900'])assert.equal(deviceCodeDetails({...flow,expires_in},false),null)
    assert.equal(deviceCodeDetails({...flow,user_code:'<script>'},false),null)
    assert.equal(deviceCodeRemaining(10000,9500),1)
    assert.equal(deviceCodeRemaining(10000,10000),0)
})
