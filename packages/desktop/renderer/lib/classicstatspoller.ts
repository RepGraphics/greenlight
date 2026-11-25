// WebRTC getStats() does not accept an AbortSignal. Never start another
// native request until the pending one settles. While it is hung, emit
// explicit unavailable samples so HUD, diagnostics and recovery stay live.
export const classicStatsRequestDeadlineMs=3000

type Pending={started:number;expired:boolean}
export class ClassicStatsPoller<T>{
    private pending:Pending|undefined
    private disposed=false
    constructor(
        private readonly read:()=>Promise<T>,
        private readonly onSample:(value:T,now:number)=>void,
        private readonly onUnavailable:(now:number)=>void,
        private readonly now:()=>number=()=>performance.now()
    ){}
    tick(){
        if(this.disposed)return
        const now=this.now()
        if(this.pending){
            if(now-this.pending.started>=classicStatsRequestDeadlineMs){
                this.pending.expired=true
                this.onUnavailable(now)
            }
            return
        }
        const request:Pending={started:now,expired:false}
        this.pending=request
        void this.collect(request)
    }
    private async collect(request:Pending){
        let value:T
        try{value=await this.read()}
        catch{
            if(this.disposed||this.pending!==request)return
            this.pending=undefined
            if(!request.expired)this.onUnavailable(this.now())
            return
        }
        if(this.disposed||this.pending!==request)return
        this.pending=undefined
        if(request.expired)return
        const now=this.now()
        if(now-request.started>=classicStatsRequestDeadlineMs){this.onUnavailable(now);return}
        this.onSample(value,now)
    }
    dispose(){this.disposed=true;this.pending=undefined}
}
