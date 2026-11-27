export function statsExpired(now:number,lastStatsAt:number,connectedAt:number):boolean {
    if(!Number.isFinite(now)||!Number.isFinite(connectedAt)||connectedAt>now)return false
    const last=Number.isFinite(lastStatsAt)&&lastStatsAt>=0&&lastStatsAt<=now?lastStatsAt:connectedAt
    return now-Math.max(last,connectedAt)>=15000
}

export type VideoWatchdogFailure='stats'|'media'
export class VisibleVideoWatchdog{
    private visibleSince:number|null=null
    reset(){this.visibleSince=null}
    sample(now:number,connected:boolean,visible:boolean,lastStatsAt:number,lastVideoStatsAt:number,mediaStalled:boolean):VideoWatchdogFailure|undefined{
        if(!connected||!visible||!Number.isFinite(now)){
            this.visibleSince=null;return
        }
        if(this.visibleSince===null||now<this.visibleSince)this.visibleSince=now
        const since=this.visibleSince
        if(statsExpired(now,lastStatsAt,since))return 'stats'
        if(statsExpired(now,lastVideoStatsAt,since))return 'media'
        if(mediaStalled&&now-since>=15000)return 'media'
    }
}
