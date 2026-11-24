// Track progress separately from ICE state: an established transport can stop delivering RTP.
export class MediaStallMonitor {
    private lastProgress:number|null=null
    private previous=new Map<string,number>()
    private lastSample:number|null=null
    private started=false
    sample(now:number, reports:ReadonlyArray<{id:string;bytes:number}>, active:boolean) {
        if(!active || (this.lastSample!==null && now-this.lastSample>5000)){
            this.previous.clear();this.lastProgress=null;this.started=false
        }
        this.lastSample=now
        if(!active)return false
        let progress=false
        for(const report of reports){
            if(!Number.isFinite(report.bytes)||report.bytes<0)continue
            const prior=this.previous.get(report.id)
            if(report.bytes>0 && (prior===undefined || report.bytes>prior))progress=true
        }
        this.previous=new Map(reports.filter(r=>Number.isFinite(r.bytes)&&r.bytes>=0).map(r=>[r.id,r.bytes]))
        if(progress){this.started=true;this.lastProgress=now}
        return this.started && this.lastProgress!==null && now-this.lastProgress>=15000
    }
}
