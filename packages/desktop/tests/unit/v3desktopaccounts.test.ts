import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DesktopAccounts,type AccountServices,type StoredXboxAccount} from '../../../desktop-v3/main/accounts'

function fixture() {
    let entries: StoredXboxAccount[] = []
    let currentIdentity = '101'
    let pendingVerification: (()=>void) | undefined
    let hold = false
    let available = true
    let revision = 0
    const names: Record<string,string> = {'101':'Northstar','202':'OrbitPilot'}
    const services: AccountServices<string> = {
        start: async () => ({device_code: currentIdentity, user_code: 'CODE-123', verification_uri: 'https://www.microsoft.com/link'}),
        verify: async code => {
            if (hold) await new Promise<void>(resolve => { pendingVerification = resolve })
            return code
        },
        refresh: async token => token.split(':')[0],
        session: async identity => ({
            refreshToken: identity+':'+(++revision),
            webToken: {data:{Token:'web-'+identity,DisplayClaims:{xui:[{uhs:identity}]}}} as Awaited<ReturnType<AccountServices<string>['session']>>['webToken'],
            streamingTokens: {xHomeToken:{data:{gsToken:'home-'+identity}}} as Awaited<ReturnType<AccountServices<string>['session']>>['streamingTokens'],
        }),
        profile: async ({uhs}) => ({id: uhs, name: names[uhs], avatar: 'https://images-eds-ssl.xboxlive.com/sample'}),
        canSave: async () => available,
        encrypt: async token => Buffer.from(token).toString('base64'),
        decrypt: async token => Buffer.from(token,'base64').toString(),
        read: () => structuredClone(entries),
        write: value => {entries = structuredClone(value)},
    }
    return {services, choose: (identity:string) => {currentIdentity=identity}, pause: () => {hold=true}, resume: () => pendingVerification?.(),
        disableStorage: () => {available=false}, read: () => structuredClone(entries)}
}

test('desktop accounts deduplicate profiles, open a saved account on restart, and isolate stream credentials', async () => {
    const mock = fixture()
    const accounts = new DesktopAccounts(mock.services)
    const prompt = await accounts.start()
    assert.equal('device_code' in prompt,false)
    const first = await accounts.finish()
    assert.equal(first.account?.name,'Northstar')
    assert.equal('refreshToken' in first,false)
    assert.equal(first.saved,true)
    assert.equal(accounts.streamRefreshToken('home','home-101'),'101:1')
    mock.choose('202')
    await accounts.start()
    const second=await accounts.finish()
    assert.equal(second.account?.name,'OrbitPilot')
    assert.throws(()=>accounts.streamRefreshToken('home','home-101'))
    mock.choose('101')
    await accounts.start()
    await accounts.finish()
    const list=(await accounts.list()).accounts
    assert.equal(list.length,2)
    assert.equal('encryptedRefreshToken' in list[0],false)
    const reopened = new DesktopAccounts(mock.services)
    const restored=await reopened.open(first.account!.id)
    assert.equal(restored.account?.id,first.account?.id)
    assert.equal(reopened.streamRefreshToken('home','home-101'),'101:4')
    reopened.remove(second.account!.id)
    assert.equal((await reopened.list()).accounts.length,1)
    assert.throws(()=>reopened.streamRefreshToken('home','home-101'))
})

test('cancelling a pending sign-in or returning a different saved identity never replaces credentials', async () => {
    const mock=fixture()
    const accounts=new DesktopAccounts(mock.services)
    await accounts.start()
    mock.pause()
    const pending=accounts.finish()
    accounts.cancel()
    mock.resume()
    await assert.rejects(pending,/cancelled/)
    assert.deepEqual(mock.read(),[])
    const first = new DesktopAccounts({...mock.services,verify:async ()=>'101'})
    await first.start()
    const saved=await first.finish()
    const before=mock.read()
    const mismatch=new DesktopAccounts({...mock.services,refresh:async ()=>'202'})
    await assert.rejects(mismatch.open(saved.account!.id),/different Xbox account/)
    assert.deepEqual(mock.read(),before)
})

test('unavailable secure storage allows a temporary session without writing a profile',async()=>{
    const mock=fixture()
    mock.disableStorage()
    const accounts=new DesktopAccounts(mock.services)
    await accounts.start()
    const session=await accounts.finish()
    assert.equal(session.saved,false)
    assert.equal(accounts.streamRefreshToken('home','home-101'),'101:1')
    assert.deepEqual(await accounts.list(),{available:false,accounts:[]})
})

test('saved accounts must verify identity before activating or replacing a credential',async()=>{
    const mock=fixture()
    const manager=new DesktopAccounts(mock.services)
    await manager.start()
    const first=await manager.finish()
    const before=mock.read()
    for(const profile of [async()=>null,async()=>{throw Error('offline')},async()=>({id:'invalid',name:'unknown'})]){
        const reopened=new DesktopAccounts({...mock.services,profile})
        await assert.rejects(reopened.open(first.account!.id),/verify the saved Xbox account identity/)
        assert.deepEqual(mock.read(),before)
        assert.throws(()=>reopened.streamRefreshToken('home','home-101'))
    }
})
test('native authorization prompt exposes only the validated public fields and expires before polling',async()=>{
    const mock=fixture()
    let now=0
    const manager=new DesktopAccounts({...mock.services,start:async()=>({device_code:'private-code',user_code:'CODE-123',verification_uri:'https://evil.invalid',expires_in:3}),verify:async()=>assert.fail('expired code polled')},()=>now)
    assert.deepEqual(await manager.start(),{user_code:'CODE-123',verification_uri:'https://microsoft.com/devicelogin',expires_in:3})
    now=3000
    await assert.rejects(manager.finish(),/expired/)
    await assert.rejects(manager.finish(),/Start Xbox sign-in/)
    assert.deepEqual(mock.read(),[])
})
test('invalid native device-code responses are never presented',async()=>{
    const mock=fixture()
    const manager=new DesktopAccounts({...mock.services,start:async()=>({device_code:'invalid code',user_code:'CODE-123',verification_uri:'https://www.microsoft.com/link'})})
    await assert.rejects(manager.start(),/code unavailable/)
    await assert.rejects(manager.finish(),/Start Xbox sign-in/)
})
