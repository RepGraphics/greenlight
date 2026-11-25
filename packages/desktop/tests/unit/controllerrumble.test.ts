import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resolveRumbleEffect} from '../../../player/src/client/lib/input/rumble'
const report={gamepadIndex:0,leftMotorPercent:.4,rightMotorPercent:.2,leftTriggerMotorPercent:.6,rightTriggerMotorPercent:.8,durationMs:200,delayMs:50,repeat:2}
const playEffect=async()=>undefined
test('V3 prefers native trigger rumble and preserves four separate motor intensities',()=>{
    const result=resolveRumbleEffect({effects:['dual-rumble','trigger-rumble'],playEffect},report)
    assert.deepEqual(result,{type:'trigger-rumble',parameters:{startDelay:0,duration:200,strongMagnitude:.4,weakMagnitude:.2,leftTrigger:.6,rightTrigger:.8},repeat:2,intervalMs:250})
})
test('dual-rumble fallback preserves a bounded approximation of trigger feedback',()=>{
    const modern=resolveRumbleEffect({effects:['dual-rumble'],playEffect},report)
    const legacy=resolveRumbleEffect({type:'dual-rumble',playEffect},report)
    assert.deepEqual(modern,legacy)
    assert.equal(modern?.type,'dual-rumble')
    assert.ok(Math.abs(modern!.parameters.weakMagnitude-.4)<1e-8)
    assert.equal(modern?.parameters.leftTrigger,undefined)
    assert.equal(modern?.parameters.rightTrigger,undefined)
})
test('effect list is authoritative and absent/unsupported actuators are ignored',()=>{
    assert.equal(resolveRumbleEffect(undefined,report),null)
    assert.equal(resolveRumbleEffect({effects:[],type:'dual-rumble',playEffect},report),null)
    assert.equal(resolveRumbleEffect({effects:['unknown'],playEffect},report),null)
    assert.equal(resolveRumbleEffect({type:'unknown',playEffect},report),null)
})
test('malformed network magnitudes, durations and repeat counts are bounded',()=>{
    const value=resolveRumbleEffect({effects:['trigger-rumble'],playEffect},{...report,leftMotorPercent:100,rightMotorPercent:-3,leftTriggerMotorPercent:NaN,rightTriggerMotorPercent:Infinity,durationMs:65535,delayMs:65535,repeat:255})!
    assert.deepEqual(value.parameters,{startDelay:0,duration:5000,strongMagnitude:1,weakMagnitude:0,leftTrigger:0,rightTrigger:0})
    assert.equal(value.intervalMs,10000)
    assert.equal(value.repeat,3)
})
test('zero duration does not schedule repeats and short pulses are rate limited',()=>{
    const actuator={effects:['dual-rumble'],playEffect}
    assert.equal(resolveRumbleEffect(actuator,{...report,durationMs:0,delayMs:0,repeat:255})?.repeat,0)
    assert.equal(resolveRumbleEffect(actuator,{...report,durationMs:1,delayMs:0})?.intervalMs,16)
})
