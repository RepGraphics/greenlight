// Use presented-frame progress rather than currentTime, which may advance
// with audio even while video is stalled. Unknown counters are not evidence
// of a stalled renderer.
export class PlaybackFrameProgress {
    private count:number|undefined
    private lastAt:number|undefined
    sample(now:number,quality:Pick<VideoPlaybackQuality,'totalVideoFrames'|'droppedVideoFrames'>|undefined){
        const total=quality?.totalVideoFrames,dropped=quality?.droppedVideoFrames
        if(typeof total!=='number'||typeof dropped!=='number'||!Number.isSafeInteger(total)||!Number.isSafeInteger(dropped)||dropped<0||total<dropped){
            this.reset()
            return undefined
        }
        const count=total-dropped
        if(this.count===undefined||count!==this.count)this.lastAt=now
        this.count=count
        return this.lastAt
    }
    reset(){this.count=undefined;this.lastAt=undefined}
}
