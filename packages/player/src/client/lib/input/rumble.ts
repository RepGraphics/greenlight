import type { VibrationFrame } from '../channel/input'

// Prefer the supported effects list over the deprecated actuator.type field.
// Ref: https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator/effects
type RumbleType='dual-rumble'|'trigger-rumble'
type RumbleParameters={startDelay:number;duration:number;strongMagnitude:number;weakMagnitude:number;leftTrigger?:number;rightTrigger?:number}
export type RumbleActuator={effects?:readonly string[];type?:string;playEffect:(type:RumbleType,parameters:RumbleParameters)=>Promise<unknown>}
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
