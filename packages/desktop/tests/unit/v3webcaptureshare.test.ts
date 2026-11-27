import {test} from 'node:test'
import assert from 'node:assert/strict'
import {canShareCapture,shareCapture,shareableCapture} from '../../../desktop-v3/renderer/utils/webcaptureshare'
import {screenshotFilename} from '../../renderer/lib/streamcapture'
import {recordingFilename} from '../../renderer/lib/streamrecording'
const date=new Date('2026-11-27T12:00:00Z')
const png=new Blob(['image'],{type:'image/png'}),webm=new Blob(['clip'],{type:'video/webm;codecs=vp8,opus'})
test('shares only existing generated capture filenames and matching media types',()=>{
    assert.equal(shareableCapture(png,screenshotFilename(date)),true)
    assert.equal(shareableCapture(webm,recordingFilename(date)),true)
    for(const name of ['../capture.png','greenlight-clip-2026.png','greenlight-2026.webm','secret.png','greenlight-2026.png.exe'])assert.equal(shareableCapture(png,name),false)
    assert.equal(shareableCapture(new Blob([],{type:'image/png'}),screenshotFilename(date)),false)
    assert.equal(shareableCapture(new Blob(['x'],{type:'text/plain'}),screenshotFilename(date)),false)
})
test('native share receives one local file and a normalized media type',async()=>{
    let calls=0
    const host={canShare:(data:ShareData)=>data.files?.length===1,share:async(data:ShareData)=>{
        calls++;assert.equal(data.files?.[0].name,recordingFilename(date))
        assert.equal(data.files?.[0].type,'video/webm')
        assert.equal(await data.files?.[0].text(),'clip')
    }}
    assert.equal(canShareCapture(host,webm,recordingFilename(date)),true)
    assert.equal(await shareCapture(host,webm,recordingFilename(date)),'shared')
    assert.equal(calls,1)
})
test('missing or rejecting share support never attempts a network fallback',async()=>{
    const host={canShare:()=>false,share:async()=>assert.fail('unsupported share')}
    assert.equal(canShareCapture({},png,screenshotFilename(date)),false)
    assert.equal(await shareCapture(host,png,screenshotFilename(date)),'unavailable')
    assert.equal(await shareCapture({},png,screenshotFilename(date)),'unavailable')
})
test('native share cancellation and failures have distinct outcomes',async()=>{
    for(const [name,result] of [['AbortError','cancelled'],['NotAllowedError','failed']]){
        const host={canShare:()=>true,share:async()=>{throw new DOMException('share',name)}}
        assert.equal(await shareCapture(host,png,screenshotFilename(date)),result)
    }
})

test('non-destructive trimmed copies share with the generated trimmed filename',()=>{
    assert.equal(shareableCapture(webm,recordingFilename(date).replace(/\.webm$/,'-trimmed.webm')),true)
    assert.equal(shareableCapture(png,screenshotFilename(date).replace(/\.png$/,'-trimmed.png')),false)
})
