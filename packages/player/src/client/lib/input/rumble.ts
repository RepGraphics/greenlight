import type { VibrationFrame } from '../channel/input'

// Prefer the supported effects list over the deprecated actuator.type field.
// Ref: https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator/effects
type RumbleType='dual-rumble'|'trigger-rumble'
type RumbleParameters={startDelay:number;duration:number;strongMagnitude:number;weakMagnitude:number;leftTrigger?:number;rightTrigger?:number}
export type RumbleActuator={effects?:readonly string[];type?:string;playEffect:(type:RumbleType,parameters:RumbleParameters)=>Promise<unknown>;reset?:()=>Promise<unknown>}
const clamp=(value:number,max:number)=>Number.isFinite(value)?Math.max(0,Math.min(max,value)):0
export function resolveRumbleEffect(actuator:Pick<RumbleActuator,'effects'|'type'|'playEffect'>|undefined,report:VibrationFrame){
    if(!actuator||typeof actuator.playEffect!=='function')return null
    const supported=Array.isArray(actuator.effects)?actuator.effects:actuator.type==='dual-rumble'?['dual-rumble']:[]
    const type:RumbleType|null=supported.includes('trigger-rumble')?'trigger-rumble':supported.includes('dual-rumble')?'dual-rumble':null
    if(!type)return null
    const left=clamp(report.leftMotorPercent,1),right=clamp(report.rightMotorPercent,1)
    const leftTrigger=clamp(report.leftTriggerMotorPercent,1),rightTrigger=clamp(report.rightTriggerMotorPercent,1)
    // Keep the legacy repeat cadence, but bound untrusted network values.
    const duration=Math.floor(clamp(report.durationMs,5000)),delay=Math.floor(clamp(report.delayMs,5000))
    const intervalMs=Math.max(16,duration+delay)
    const repeat=duration===0?0:Math.min(Math.floor(clamp(report.repeat,255)),Math.floor(30000/intervalMs))
    const parameters:RumbleParameters={startDelay:0,duration,strongMagnitude:left,weakMagnitude:right}
    if(type==='trigger-rumble'){
        parameters.leftTrigger=leftTrigger
        parameters.rightTrigger=rightTrigger
    }else{
        const headroom=right<.6?(.6-right)/2:0
        parameters.weakMagnitude=Math.min(1,right+Math.min(headroom,(leftTrigger+rightTrigger)/4))
    }
    return {type,parameters,repeat,intervalMs}
}

// A controller can disconnect while an effect is still playing, so remember
// the actuator that received it rather than looking up a new pad by index.
export class RumblePlayback {
    private generation=0
    private timer:ReturnType<typeof setTimeout>|undefined
    private actuator:RumbleActuator|undefined
    private effect:ReturnType<typeof resolveRumbleEffect>=null
    constructor(private schedule:typeof setTimeout=setTimeout,private cancel:typeof clearTimeout=clearTimeout){}
    private clearTimer(){
        this.generation++
        if(this.timer!==undefined)this.cancel(this.timer)
        this.timer=undefined
    }
    stop(){
        this.clearTimer()
        const actuator=this.actuator,effect=this.effect
        this.actuator=undefined;this.effect=null
        if(!actuator||!effect)return
        // Never await a browser haptic operation or let a late rejection
        // trigger another command after a newer effect has started.
        try{
            const result=typeof actuator.reset==='function'?actuator.reset():actuator.playEffect(effect.type,{
                ...effect.parameters,duration:0,startDelay:0,strongMagnitude:0,weakMagnitude:0,
                ...(effect.type==='trigger-rumble'?{leftTrigger:0,rightTrigger:0}:{})
            })
            void Promise.resolve(result).catch(()=>{})
        }catch{}
    }
    start(actuator:RumbleActuator|undefined,report:VibrationFrame,owns:()=>boolean){
        const effect=resolveRumbleEffect(actuator,report)
        if(!actuator||!effect||!owns()){this.stop();return false}
        if(this.actuator&&this.actuator!==actuator)this.stop()
        else this.clearTimer()
        this.actuator=actuator;this.effect=effect
        const epoch=this.generation
        const current=()=>epoch===this.generation&&this.actuator===actuator
        let repeats=effect.repeat
        const play=()=>{
            if(!current())return false
            if(!owns()){this.stop();return false}
            try{void Promise.resolve(actuator.playEffect(effect.type,effect.parameters)).catch(()=>{})}
            catch{this.stop();return false}
            return true
        }
        const next=()=>{
            if(!current())return
            this.timer=undefined
            if(repeats<=0||!play())return
            if(--repeats>0&&current())this.timer=this.schedule(next,effect.intervalMs)
        }
        if(!play())return false
        if(repeats>0&&current())this.timer=this.schedule(next,effect.intervalMs)
        return true
    }
}
