import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectWebControllerPreset,parseWebDeadzone,parseWebVolume,webControllerOptions} from '../../../desktop-v3/renderer/utils/controlleroptions'

test('web controller presets share desktop mappings and axis options',()=>{
    const standard=selectWebControllerPreset('standard')
    assert.equal(standard.v3_deadzone,0.08)
    assert.equal(standard.v3_button_mapping.A,'0')
    assert.equal(selectWebControllerPreset('southpaw').v3_swap_sticks,true)
    assert.equal(selectWebControllerPreset('inverted').v3_invert_y,true)
    const alternate=selectWebControllerPreset('alternate')
    assert.deepEqual(['A','B','X','Y'].map(button=>alternate.v3_button_mapping[button]),['1','0','3','2'])
})
test('unknown preset identifiers fall back to a fresh standard profile',()=>{
    const standard=selectWebControllerPreset('standard')
    for(const value of [null,'unknown','__proto__','constructor',42]){
        const profile=selectWebControllerPreset(value)
        assert.deepEqual(profile,standard)
        assert.notEqual(profile.v3_button_mapping,standard.v3_button_mapping)
    }
    const profile=selectWebControllerPreset('standard')
    profile.v3_button_mapping.A='63'
    assert.equal(selectWebControllerPreset('standard').v3_button_mapping.A,'0')
})
test('deadzone slider accepts only whole percentages between zero and fifty',()=>{
    for(const [input,expected] of [['0',0],['8',.08],['50',.5]] as const)assert.equal(parseWebDeadzone(input),expected)
    for(const input of ['','-1','51','100','1.5','NaN','Infinity',' 8','08','1e1'])assert.equal(parseWebDeadzone(input),null)
})
test('controller options keep a stable button mapping and suppress vibration in console-paired mode',()=>{
    const profile=selectWebControllerPreset('alternate')
    const first=webControllerOptions(profile,true,false)
    const second=webControllerOptions(profile,false,false)
    assert.equal(first.buttonMapping,profile.v3_button_mapping)
    assert.equal(second.buttonMapping,first.buttonMapping)
    assert.equal(first.vibration,true)
    assert.equal(second.vibration,false)
    assert.equal(webControllerOptions(profile,true,true).vibration,false)
    assert.equal(webControllerOptions({...profile,v3_invert_y:true,v3_swap_sticks:true,v3_deadzone:.2},true,false).deadzone,.2)
})
test('volume slider accepts only whole percentages in the unit interval',()=>{
    assert.equal(parseWebVolume('0'),0)
    assert.equal(parseWebVolume('65'),.65)
    assert.equal(parseWebVolume('100'),1)
    for(const input of ['','-1','101','5.5','NaN','Infinity',' 50','00','1e2'])assert.equal(parseWebVolume(input),null)
})
