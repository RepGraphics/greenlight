// Require an established, continuously observed stream before declaring a
// stats stall. A missing poll, a clock reset or a background window is not
// proof of a frozen stream. Never interpret this as congestion.
export const classicStatsStallSeconds=15
const maxSampleGapSeconds=3

export class ClassicStatsWatchdog {
    private armed=false
    private previous:number|null=null
    private staleSince:number|null=null
    private failed=false
    reset(){this.armed=false;this.previous=null;this.staleSince=null;this.failed=false}
    observe(seconds:number,fresh:boolean|undefined,visible:boolean):boolean{
        if(this.failed)return false
        if(!visible||!Number.isFinite(seconds)||seconds<0||typeof fresh!=='boolean'){
            this.reset();return false
        }
        if(this.previous!==null&&(seconds<=this.previous||seconds-this.previous>maxSampleGapSeconds))this.reset()
        this.previous=seconds
        if(fresh){this.armed=true;this.staleSince=null;return false}
        if(!this.armed)return false
        if(this.staleSince===null){this.staleSince=seconds;return false}
        if(seconds-this.staleSince<classicStatsStallSeconds)return false
        this.failed=true
        return true
    }
}
