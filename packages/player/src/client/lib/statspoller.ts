export const v3StatsDeadlineMs=5000

// Native getStats() cannot be cancelled. Do not launch a replacement while
// an earlier native request remains unresolved, even if it timed out.
export class StatsPoller<T>{
    private pending=false
    private disposed=false
    constructor(private read:()=>Promise<T>,private consume:(value:T,now:number)=>void,private now:()=>number=()=>performance.now()){}
    tick(){
        if(this.disposed||this.pending)return
        const started=this.now()
        if(!Number.isFinite(started))return
        this.pending=true
        void this.collect(started)
    }
    private async collect(started:number){
        try{
            const value=await this.read()
            const now=this.now()
            if(!this.disposed&&Number.isFinite(now)&&now>=started&&now-started<v3StatsDeadlineMs)this.consume(value,now)
        }catch{/* Leave lastStatsAt unchanged; the session watchdog detects stale data. */}
        finally{this.pending=false}
    }
    dispose(){this.disposed=true}
}
