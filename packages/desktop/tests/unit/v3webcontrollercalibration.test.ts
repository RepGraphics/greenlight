import {test} from 'node:test'
import assert from 'node:assert/strict'
import {calibrationPads,calibratable,WebDeadzoneCalibration,type CalibrationPad} from '../../../desktop-v3/renderer/utils/webcontrollercalibration'

const pad=(axes:readonly number[]=[.01,-.04,.02,0],index=0,id='controller',mapping='standard'):CalibrationPad=>({index,id,mapping,axes})
test('calibration requires a connected standard four-axis gamepad with valid values',()=>{
    assert.equal(calibratable(pad()),true)
    for(const value of [undefined,pad([0,0]),pad([0,0,0,NaN]),pad([0,0,0,1.1]),pad([0,0,0,0],0,'controller','')])assert.equal(calibratable(value),false)
    const device={connected:true,index:2,id:'test',mapping:'standard',axes:[0,0,0,0,1]} as unknown as Gamepad
    assert.deepEqual(calibrationPads([null,{connected:false} as Gamepad,device]),[pad([0,0,0,0],2,'test')])
})
test('three seconds of resting samples recommend a bounded deadzone with margin',()=>{
    const job=new WebDeadzoneCalibration(pad(),0)
    for(let time=50;time<3000;time+=50)assert.equal(job.sample([pad()],time,true).kind,'running')
    assert.deepEqual(job.sample([pad()],3000,true),{kind:'ready',deadzone:.06})
    assert.deepEqual(job.sample([],4000,false),{kind:'ready',deadzone:.06})
})
test('large stick movement invalidates the measurement',()=>{
    const job=new WebDeadzoneCalibration(pad(),0)
    for(let time=50;time<3000;time+=50)job.sample([pad(time===500?[.6,0,0,0]:[0,0,0,0])],time,true)
    assert.deepEqual(job.sample([pad()],3000,true),{kind:'failed'})
})
test('loss of focus, controller replacement and unsupported axes cancel measurements',()=>{
    for(const [pads,focused] of [[[],true],[[pad(undefined,1)],true],[[pad(undefined,0,'different')],true],[[pad([0,0,NaN,0])],true],[[pad()],false]] as const){
        const job=new WebDeadzoneCalibration(pad(),0)
        assert.deepEqual(job.sample(pads,50,focused),{kind:'failed'})
        assert.deepEqual(job.sample([pad()],100,true),{kind:'failed'})
    }
})
test('suspended, nonmonotonic and invalid sampling clocks fail safely',()=>{
    for(const time of [251,-1,NaN,Infinity]){
        const job=new WebDeadzoneCalibration(pad(),0)
        assert.deepEqual(job.sample([pad()],time,true),{kind:'failed'})
    }
})
test('insufficient samples cannot produce a calibration recommendation',()=>{
    const job=new WebDeadzoneCalibration(pad(),0)
    for(let time=250;time<3000;time+=250)assert.equal(job.sample([pad()],time,true).kind,'running')
    assert.deepEqual(job.sample([pad()],3000,true),{kind:'failed'})
})
