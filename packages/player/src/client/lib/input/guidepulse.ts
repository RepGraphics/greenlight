// Start timing on the first sampled frame, not on the UI click. This avoids
// dropping a short guide press when the polling loop is briefly delayed.
export class GuidePulse{
    private phase:'idle'|'queued'|'pressed'='idle'
    private until=0
    get pending(){return this.phase!=='idle'}
    request(){
        if(this.phase!=='idle')return false
        this.phase='queued';return true
    }
    sample(now:number){
        if(this.phase==='queued'){this.phase='pressed';this.until=now+120;return true}
        if(this.phase==='pressed'){
            if(now<this.until)return true
            this.clear()
        }
        return false
    }
    clear(){this.phase='idle';this.until=0}
}
