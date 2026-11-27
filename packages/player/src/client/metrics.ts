// Dependency-free metrics contract shared by the player and diagnostic tools.
export interface StreamMetrics { width: number; height: number; fps: number; bitrate: number; jitter: number; loss: number; rtt: number; statsAgeMs?:number; statsFresh?:boolean; peerState?:string; iceState?:string; signalingState?:string }

export const networkStatsFresh=(lastStatsAt:number,now:number)=>{
    const age=now-lastStatsAt
    return Number.isFinite(lastStatsAt)&&lastStatsAt>0&&Number.isFinite(age)&&age>=0&&age<5000
}
export const nonnegativeMetric=(value:number)=>Number.isFinite(value)&&value>=0?value:0
