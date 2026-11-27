// A renderer may initialize successfully and later stop delivering frames.
// FPS is a historical average and cannot by itself detect that stall.
export class GpuFrameWatchdog {
    private lastFrame:number|undefined
    private visibleSince:number|undefined
    constructor(private startedAt:number){}
    rendered(now:number){
        if(Number.isFinite(now)&&now>=this.startedAt&&(this.lastFrame===undefined||now>=this.lastFrame))this.lastFrame=now
    }
    stalled(now:number,visible:boolean,connected:boolean){
        if(!visible||!connected||!Number.isFinite(now)||now<this.startedAt){
            this.visibleSince=undefined
            return false
        }
        this.visibleSince??=now
        const reference=Math.max(this.lastFrame??this.startedAt,this.visibleSince)
        return now-reference>=(this.lastFrame===undefined?10000:5000)
    }
}
