import {ButtonCapture,captureButtonMapping} from '../../../desktop/renderer/lib/controllerbinding'
import {defaultButtonMapping} from '../../../player/src/client/lib/input/mapping'

export const webBindingTargets=Object.keys(defaultButtonMapping)
export function updateWebBinding(mapping:Record<string,string>,target:string,value:string){
    if(!webBindingTargets.includes(target)||!/^(?:[0-9]|[1-5][0-9]|6[0-3])$/.test(value))return mapping
    if(mapping[target]===value)return mapping
    return captureButtonMapping(mapping,target,Number(value))
}
export type BindingPad={index:number;id:string;buttons:readonly number[]}
export function readBindingPads(gamepads:readonly (Gamepad|null)[]):BindingPad[]{
    return gamepads.filter((pad):pad is Gamepad=>Boolean(pad?.connected)).map(pad=>({
        index:pad.index,id:pad.id,buttons:Array.from(pad.buttons).slice(0,64).map(button=>button.value),
    }))
}
export class WebButtonListener{
    private capture:ButtonCapture
    constructor(private pad:BindingPad,private deadline:number){
        this.capture=new ButtonCapture(pad.buttons)
    }
    sample(pads:BindingPad[],now:number,focused:boolean){
        const current=pads.find(pad=>pad.index===this.pad.index&&pad.id===this.pad.id)
        if(!focused||now>=this.deadline||!current)return {kind:'failed'} as const
        return this.capture.sample(current.buttons)
    }
}
