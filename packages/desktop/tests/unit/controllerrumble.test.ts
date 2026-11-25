import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resolveRumbleEffect,RumblePlayback} from '../../../player/src/client/lib/input/rumble'
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

function playbackFixture(){
    let next=0
    const timers=new Map<number,()=>void>()
    const schedule=((fn:()=>void)=>{timers.set(++next,fn);return next}) as unknown as typeof setTimeout
    const cancel=((id:number)=>timers.delete(id)) as unknown as typeof clearTimeout
    const playback=new RumblePlayback(schedule,cancel)
    const tick=()=>{const entry=timers.entries().next().value;if(!entry)throw Error('No timer');timers.delete(entry[0]);entry[1]()}
    const device=()=>{
        const calls:Array<{type:string;params?:any}>=[]
        return {calls,actuator:{effects:['trigger-rumble'],async playEffect(type:string,params:any){calls.push({type,params})},async reset(){calls.push({type:'reset'})}}}
    }
    return {playback,timers,tick,device}
}
test('rumble cancellation resets the original actuator and ignores stale repeat callbacks',()=>{
    const f=playbackFixture(),a=f.device(),b=f.device()
    f.playback.start(a.actuator,report,()=>true)
    const stale=[...f.timers.values()][0]
    f.playback.start(b.actuator,report,()=>true)
    assert.deepEqual(a.calls.map(c=>c.type),['trigger-rumble','reset'])
    const active=[...f.timers.keys()][0]
    stale();assert.deepEqual([...f.timers.keys()],[active])
    assert.equal(b.calls.length,1)
    f.playback.stop();f.playback.stop()
    assert.deepEqual(b.calls.map(c=>c.type),['trigger-rumble','reset'])
    assert.equal(f.timers.size,0)
})
test('new reports replace a pulse on the same actuator without an intervening reset',()=>{
    const f=playbackFixture(),a=f.device()
    f.playback.start(a.actuator,report,()=>true)
    const stale=[...f.timers.values()][0]
    f.playback.start(a.actuator,{...report,repeat:1,leftMotorPercent:.7},()=>true)
    stale();f.tick()
    assert.equal(a.calls.length,3)
    assert.equal(a.calls.at(-1)?.params.strongMagnitude,.7)
    assert.equal(f.timers.size,0)
    f.playback.stop();assert.equal(a.calls.at(-1)?.type,'reset')
})
test('lost actuator ownership cancels rather than vibrating a replacement controller',()=>{
    const f=playbackFixture(),a=f.device();let owns=true
    f.playback.start(a.actuator,report,()=>owns);owns=false;f.tick()
    assert.deepEqual(a.calls.map(c=>c.type),['trigger-rumble','reset'])
    assert.equal(f.timers.size,0)
})
test('legacy actuator stop uses a zero intensity effect and handles rejection',async()=>{
    const f=playbackFixture(),calls:any[]=[]
    const actuator={effects:['dual-rumble'],async playEffect(type:string,params:any){calls.push({type,params});if(params.duration===0)throw Error('unplugged')}}
    f.playback.start(actuator,report,()=>true)
    f.playback.stop()
    assert.deepEqual(calls[1],{type:'dual-rumble',params:{startDelay:0,duration:0,strongMagnitude:0,weakMagnitude:0}})
    await Promise.resolve()
    assert.equal(f.timers.size,0)
})
