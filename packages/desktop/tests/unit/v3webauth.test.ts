import {test} from 'node:test'
import assert from 'node:assert/strict'
import {AuthAttempt,clearLegacyUserToken} from '../../../desktop-v3/renderer/contexts/authattempt'
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
