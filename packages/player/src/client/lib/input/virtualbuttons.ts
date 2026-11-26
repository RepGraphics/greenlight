// A complete virtual button tap may fall between two input polls.
// Preserve its peak strength for one sample, then send the release.
export class VirtualButtonState{
    private held=new Map<string,{value:number;sampled:boolean}>()
    private taps=new Map<string,number>()
    private releasePending=false
    get pending(){return this.held.size>0||this.taps.size>0||this.releasePending}
    set(button:string,value:number,preserveTap=true){
        if(!Number.isFinite(value))return
        const strength=Math.max(0,Math.min(1,value))
        const entry=this.held.get(button)
        if(strength>0){
            if(entry)entry.value=strength
            else this.held.set(button,{value:strength,sampled:false})
        }else if(entry){
            this.held.delete(button)
            if(preserveTap&&!entry.sampled)this.taps.set(button,Math.max(this.taps.get(button)??0,entry.value))
            this.releasePending=true
        }
        if(!preserveTap&&strength===0)this.taps.delete(button)
    }
    read(){
        const result=new Map(this.taps)
        this.releasePending=this.taps.size>0
        this.taps.clear()
        for(const [button,entry] of this.held){
            result.set(button,Math.max(result.get(button)??0,entry.value))
            entry.sampled=true
        }
        return result
    }
    clear(){this.held.clear();this.taps.clear();this.releasePending=false}
}
