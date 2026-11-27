import {test} from 'node:test'
import assert from 'node:assert/strict'
import {videoCodecCapability,capabilityRows,capabilityReport,type DeviceCapabilities} from '../../../desktop-v3/renderer/utils/devicecapabilities'
const base:DeviceCapabilities={secure:true,webrtc:true,h264:'available',gamepad:true,touch:false,microphone:true,recording:true,fullscreen:true,pip:false,wakeLock:true,clipboard:true}
test('H.264 detection uses advertised receiver codecs case-insensitively',()=>{
    assert.equal(videoCodecCapability({getCapabilities:()=>({codecs:[{mimeType:'video/H264'}]})}),'available')
    assert.equal(videoCodecCapability({getCapabilities:()=>({codecs:[{mimeType:'video/VP9'}]})}),'unavailable')
})
test('missing or throwing receiver capability API is unknown, not unsupported',()=>{
    assert.equal(videoCodecCapability(undefined),'unknown')
    assert.equal(videoCodecCapability({getCapabilities:()=>null}),'unknown')
    assert.equal(videoCodecCapability({getCapabilities:()=>{throw Error('unsupported')}}),'unknown')
})
test('capability rows distinguish available, unavailable and unknown features',()=>{
    const rows=capabilityRows({...base,h264:'unknown'})
    assert.equal(rows.length,11)
    assert.equal(rows.find(row=>row.label.startsWith('H.264'))?.state,'unknown')
    assert.equal(rows.find(row=>row.label==='Touch input detected')?.state,'unavailable')
    assert.equal(rows.find(row=>row.label==='WebRTC peer connection')?.state,'available')
})
test('report is allowlisted and does not serialize unexpected object fields',()=>{
    const data={...base,token:'secret',host:'secret',userAgent:'secret',gamepadId:'secret'}
    const report=capabilityReport(data)
    assert.equal(report.includes('secret'),false)
    assert.match(report,/API presence only/)
    assert.match(report,/Secure context: available/)
})
