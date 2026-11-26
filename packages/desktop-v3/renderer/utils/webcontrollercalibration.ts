import {recommendDeadzone} from '../../../desktop/renderer/lib/controllercalibration'

export type CalibrationPad={index:number;id:string;mapping:string;axes:readonly number[]}
export type CalibrationResult={kind:'running';remaining:number}|{kind:'ready';deadzone:number}|{kind:'failed'}
export function calibrationPads(gamepads:readonly (Gamepad|null)[]):CalibrationPad[]{
    return gamepads.filter((pad):pad is Gamepad=>Boolean(pad?.connected)).map(pad=>({
        index:pad.index,id:pad.id,mapping:pad.mapping,axes:Array.from(pad.axes).slice(0,4),
    }))
}
export function calibratable(pad:CalibrationPad|undefined):pad is CalibrationPad{
    return Boolean(pad&&pad.mapping==='standard'&&pad.axes.length===4&&pad.axes.every(value=>Number.isFinite(value)&&Math.abs(value)<=1))
}
// A timed, bounded rest measurement. Never reuse samples after a controller
// disconnect, loss of focus or a long gap caused by browser suspension.
export class WebDeadzoneCalibration{
    private samples:number[][]=[]
    private last:number
    private result?:CalibrationResult
    constructor(private selected:CalibrationPad,private start:number){
        this.last=start
    }
    sample(pads:readonly CalibrationPad[],now:number,focused:boolean):CalibrationResult{
        if(this.result)return this.result
        const pad=pads.find(item=>item.index===this.selected.index&&item.id===this.selected.id)
        if(!focused||!calibratable(pad)||!Number.isFinite(now)||now<this.last||now-this.last>250||now-this.start>3250){
            return this.result={kind:'failed'}
        }
        if(now-this.last>=40){
            this.samples.push([...pad.axes])
            this.last=now
        }
        if(now-this.start<3000)return {kind:'running',remaining:Math.ceil((3000-(now-this.start))/1000)}
        const deadzone=recommendDeadzone(this.samples)
        return this.result=deadzone===null?{kind:'failed'}:{kind:'ready',deadzone}
    }
}
