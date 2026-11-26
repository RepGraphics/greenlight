import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectWebVideoPreset,updateWebVideoFilter,webVideoPresentation,webVideoPresets} from '../../../desktop-v3/renderer/utils/videoappearance'
import {videoPresets,neutralFilters,videoFilterCss,sharpeningKernel} from '../../renderer/lib/videofilters'

test('web presets use the same validated appearance as desktop',()=>{
    for(const {id} of webVideoPresets){
        assert.deepEqual(selectWebVideoPreset(id),videoPresets[id])
        assert.notEqual(selectWebVideoPreset(id),videoPresets[id])
    }
})
test('unknown presets return fresh neutral filters',()=>{
    for(const value of [null,42,'unknown','constructor','__proto__'])assert.deepEqual(selectWebVideoPreset(value),neutralFilters)
    const result=selectWebVideoPreset('neutral')
    result.brightness=150
    assert.equal(selectWebVideoPreset('neutral').brightness,100)
})
test('valid slider values preserve unrelated adjustments',()=>{
    const start=selectWebVideoPreset('vivid')
    const changed=updateWebVideoFilter(start,'brightness','150')
    assert.deepEqual(changed,{...start,brightness:150})
    assert.equal(start.brightness,105)
    assert.equal(updateWebVideoFilter(changed,'saturation','0').saturation,0)
    assert.equal(updateWebVideoFilter(changed,'sharpening','100').sharpening,100)
})
test('invalid keys and values never change filter state',()=>{
    const start=selectWebVideoPreset('neutral')
    for(const [key,value] of [['brightness','49'],['contrast','151'],['saturation','201'],['sharpening','101'],['brightness','1e2'],['brightness','100.5'],['brightness',' 100'],['brightness','NaN'],['__proto__','100'],['filter','100']]){
        assert.equal(updateWebVideoFilter(start,key,value),start)
    }
})
test('presentation validates values and enables sharpening only when requested',()=>{
    assert.deepEqual(webVideoPresentation(neutralFilters),{filter:videoFilterCss(neutralFilters),kernel:null})
    const clarity=selectWebVideoPreset('clarity')
    assert.deepEqual(webVideoPresentation(clarity),{filter:videoFilterCss(clarity),kernel:sharpeningKernel(25)})
    const invalid=webVideoPresentation({brightness:'url(https://evil.example)',contrast:999,saturation:-10,sharpening:Infinity})
    assert.deepEqual(invalid,{filter:'brightness(100%) contrast(150%) saturate(0%)',kernel:null})
})
