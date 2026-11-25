type Frame={GamepadIndex:number;[name:string]:number}
export type StickSide='Left'|'Right'
const buttons=new Set(['A','B','X','Y','Nexus','Menu','View','DPadUp','DPadDown','DPadLeft','DPadRight','LeftShoulder','RightShoulder','LeftTrigger','RightTrigger','LeftThumb','RightThumb'])
const clamp=(n:number)=>Number.isFinite(n)?Math.max(-1,Math.min(1,n)):0
export class ClassicVirtualPad{
    private held=new Map<number,string>()
    private sticks=new Map<StickSide,{pointer:number;x:number;y:number}>()
    private releasePending=false
    press(pointer:number,button:string){
        if(!Number.isSafeInteger(pointer)||!buttons.has(button)||this.held.has(pointer))return false
        this.held.set(pointer,button);return true
    }
    release(pointer:number){if(this.held.delete(pointer))this.releasePending=true}
    move(side:StickSide,pointer:number,x:number,y:number){
        const current=this.sticks.get(side)
        if(current&&current.pointer!==pointer)return false
        if(!Number.isSafeInteger(pointer))return false
        x=clamp(x);y=clamp(y);const length=Math.max(1,Math.hypot(x,y))
        this.sticks.set(side,{pointer,x:x/length,y:y/length});return true
    }
    releaseStick(side:StickSide,pointer:number){
        if(this.sticks.get(side)?.pointer===pointer){this.sticks.delete(side);this.releasePending=true}
    }
    releaseAll(){
        if(this.held.size||this.sticks.size)this.releasePending=true
        this.held.clear();this.sticks.clear()
    }
    reset(){this.held.clear();this.sticks.clear();this.releasePending=false}
    merge(frames:Frame[],neutral:Frame):Frame[]{
        if(!this.held.size&&!this.sticks.size&&!this.releasePending)return frames
        const frame={...neutral,...frames[0],GamepadIndex:0}
        for(const button of this.held.values())frame[button]=1
        for(const [side,stick] of this.sticks){frame[side+'ThumbXAxis']=stick.x;frame[side+'ThumbYAxis']=-stick.y}
        this.releasePending=false
        return [frame]
    }
}
