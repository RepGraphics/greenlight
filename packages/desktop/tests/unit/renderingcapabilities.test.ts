import {test} from 'node:test'
import assert from 'node:assert/strict'
import {inspectRenderingCapabilities} from '../../renderer/lib/renderingcapabilities'

test('unknown browser features do not become false HDR claims',()=>{
    assert.deepEqual(inspectRenderingCapabilities({}),{displayHdr:null,videoHdr:null,wideGamut:null,webGpuApi:null,codecs:null})
})
test('display and video HDR hints are independent',()=>{
    const supported=['(dynamic-range: high)','(video-dynamic-range: standard)','(color-gamut: p3)']
    const result=inspectRenderingCapabilities({matchMedia:query=>({matches:supported.includes(query)}),webGpu:true,codecs:()=>[{mimeType:'video/H264'},{mimeType:'video/h264'},{mimeType:'video/VP9'},{mimeType:'audio/opus'}]})
    assert.deepEqual(result,{displayHdr:true,videoHdr:false,wideGamut:true,webGpuApi:true,codecs:['video/h264','video/vp9']})
})
test('failed optional capability probes remain unknown',()=>{
    const result=inspectRenderingCapabilities({matchMedia:()=>{throw Error('unavailable')},webGpu:false,codecs:()=>{throw Error('unavailable')}})
    assert.equal(result.displayHdr,null)
    assert.equal(result.videoHdr,null)
    assert.equal(result.webGpuApi,false)
    assert.equal(result.codecs,null)
})
