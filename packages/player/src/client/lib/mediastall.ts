// Track progress separately from ICE state: an established transport can stop delivering RTP.
export class MediaStallMonitor {
    private lastProgress:number|null=null
    private previous=new Map<string,number>()
    private lastSample:number|null=null
    private activeSince:number|null=null
    sample(now:number, reports:ReadonlyArray<{id:string;bytes:number}>, active:boolean) {
        if(!Number.isFinite(now)||!active || (this.lastSample!==null && (now<this.lastSample||now-this.lastSample>5000))){
            this.previous.clear();this.lastProgress=null;this.activeSince=null
        }
        this.lastSample=Number.isFinite(now)?now:null
        if(!active||!Number.isFinite(now))return false
        this.activeSince??=now
        let progress=false
        for(const report of reports){
            if(!Number.isFinite(report.bytes)||report.bytes<0)continue
            const prior=this.previous.get(report.id)
            if(report.bytes>0 && (prior===undefined || report.bytes>prior))progress=true
        }
        this.previous=new Map(reports.filter(r=>Number.isFinite(r.bytes)&&r.bytes>=0).map(r=>[r.id,r.bytes]))
        if(progress)this.lastProgress=now
        // Allow a longer initial grace period before the first video bytes.
        return this.lastProgress!==null?now-this.lastProgress>=15000:now-this.activeSince>=20000
    }
}
