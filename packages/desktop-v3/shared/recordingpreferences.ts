export const webReplayDurations=[15,30,60] as const
export const webRecordingDurations=[60,180,300] as const
export const webRecordingBitrates=[1500000,3000000,6000000] as const

export function webRecordingPreferences(seconds:unknown,videoBitsPerSecond:unknown){
    return {
        seconds:webRecordingDurations.find(value=>value===seconds)??60,
        videoBitsPerSecond:webRecordingBitrates.find(value=>value===videoBitsPerSecond)??3000000,
    }
}
