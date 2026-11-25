import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectForkRelease} from '../../main/helpers/updaterelease'
import {isAllowedIpc,isAllowedWebIpc} from '../../main/ipc/policy'
const release=(tag_name:string,extra={})=>({tag_name,draft:false,prerelease:false,body:'notes',...extra})
test('updater selects highest valid stable version regardless of API order',()=>{
    const result=selectForkRelease([release('v2.5.0'),release('v2.9.1'),release('v3.0.0-beta.1',{prerelease:true}),release('dev-2026'),release('v9.0.0',{draft:true})],'2.4.2')
    assert.equal(result.status,'available');assert.equal(result.release?.tag,'v2.9.1')
})
test('prerelease channel includes stable versions and never downgrades',()=>{
    assert.equal(selectForkRelease([release('v3.0.0-beta.2',{prerelease:true}),release('v3.0.0')],'3.0.0-beta.1',true).release?.tag,'v3.0.0')
    assert.equal(selectForkRelease([release('v2.0.0')],'2.4.2').status,'current')
    assert.equal(selectForkRelease([release('v3.0.0-beta.1')],'2.4.2').status,'none')
})
test('untrusted release URLs are ignored and links remain pinned to the fork',()=>{
    const result=selectForkRelease([release('v2.5.0',{html_url:'https://example.org/installer',body:'x'.repeat(18000)})],'2.4.2')
    assert.equal(result.release?.url,'https://github.com/RepGraphics/greenlight/releases/tag/v2.5.0')
    assert.equal(result.release?.notes.length,16000)
    assert.equal(selectForkRelease([],'2.4.2').status,'none')
    assert.throws(()=>selectForkRelease([],'invalid'))
})
test('manual update check is restricted to desktop IPC',()=>{
    assert.equal(isAllowedIpc('app','checkForUpdates'),true)
    assert.equal(isAllowedWebIpc('app','checkForUpdates'),false)
})
