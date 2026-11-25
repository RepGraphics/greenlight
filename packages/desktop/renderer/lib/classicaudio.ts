// Classic creates and replaces its audio element asynchronously. The controls
// own playback preferences, not the transient DOM element.
export function normalizeClassicVolume(value:number,fallback=1){
    return Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback
}

export function observeClassicAudio(holder:HTMLElement,volume:number,muted:boolean){
    let active=true
    const sync=()=>{
        if(!active)return
        const audio=holder.querySelector<HTMLAudioElement>('audio')
        if(!audio)return
        audio.volume=normalizeClassicVolume(volume)
        audio.muted=muted
    }
    const observer=new MutationObserver(sync)
    observer.observe(holder,{childList:true,subtree:true})
    sync()
    return ()=>{active=false;observer.disconnect()}
}
