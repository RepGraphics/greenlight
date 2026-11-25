import {defaultButtonMapping,validateButtonMapping} from '../../../player/src/client/lib/input/mapping'
type CaptureResult={kind:'waiting'|'ambiguous'}|{kind:'captured';index:number}
const value=(buttons:readonly number[],index:number)=>Number.isFinite(buttons[index])?buttons[index]:0
// Ignore held buttons and resting triggers; require release after ambiguity.
export class ButtonCapture{
    private armed:boolean[]
    private blocked=false
    constructor(initial:readonly number[]){
        this.armed=Array.from({length:64},(_,index)=>value(initial,index)<=.25)
    }
    sample(buttons:readonly number[]):CaptureResult{
        const count=Math.min(64,buttons.length)
        if(this.blocked){
            if(Array.from({length:count},(_,index)=>value(buttons,index)).some(n=>n>.25))return {kind:'ambiguous'}
            this.blocked=false;this.armed.fill(true);return {kind:'waiting'}
        }
        const pressed:number[]=[]
        for(let index=0;index<count;index++){
            const n=value(buttons,index)
            if(n<=.25)this.armed[index]=true
            else if(n>=.75&&this.armed[index]){this.armed[index]=false;pressed.push(index)}
        }
        if(pressed.length>1){this.blocked=true;return {kind:'ambiguous'}}
        return pressed.length===1?{kind:'captured',index:pressed[0]}:{kind:'waiting'}
    }
}
export function captureButtonMapping(previous:unknown,target:string,index:number){
    const mapping=validateButtonMapping(previous)
    if(Object.prototype.hasOwnProperty.call(defaultButtonMapping,target)&&Number.isInteger(index)&&index>=0&&index<64)mapping[target]=String(index)
    return mapping
}
