// Dependency-free metrics contract shared by the player and diagnostic tools.
export interface StreamMetrics { width: number; height: number; fps: number; bitrate: number; jitter: number; loss: number; rtt: number; statsAgeMs?:number; statsFresh?:boolean; peerState?:string; iceState?:string; signalingState?:string }
