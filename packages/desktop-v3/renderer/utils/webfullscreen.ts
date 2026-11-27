type FullscreenDocument=Pick<Document,'fullscreenEnabled'|'fullscreenElement'|'exitFullscreen'>
type FullscreenTarget=Pick<HTMLElement,'requestFullscreen'|'isConnected'>

export class WebFullscreen {
    private owned=false
    private pending=false
    private disposed=false
    private enabled=true
    private releaseOnSettle=false
    constructor(private document:FullscreenDocument,private target:FullscreenTarget){}
    state(){
        const active=this.document.fullscreenElement===this.target
        if(!active&&!this.pending)this.owned=false
        const available=active?typeof this.document.exitFullscreen==='function':
            !this.document.fullscreenElement&&this.document.fullscreenEnabled===true&&this.target.isConnected&&typeof this.target.requestFullscreen==='function'
        return {active,available:!this.disposed&&this.enabled&&Boolean(available),busy:this.pending}
    }
    async toggle(){
        if(this.disposed||!this.enabled||this.pending)return false
        if(!this.state().available)throw Error('Fullscreen unavailable')
        this.pending=true
        this.releaseOnSettle=false
        try{
            if(this.document.fullscreenElement===this.target){
                await this.document.exitFullscreen()
                this.owned=false
            }else{
                await this.target.requestFullscreen()
                this.owned=this.document.fullscreenElement===this.target
            }
            return !this.disposed&&this.enabled&&!this.releaseOnSettle
        }finally{
            // Keep the operation locked until any late entry has been exited.
            try{if(this.disposed||!this.enabled||this.releaseOnSettle)await this.release()}
            finally{this.pending=false}
        }
    }
    private async release(){
        const owned=this.owned
        this.owned=false
        if(owned&&this.document.fullscreenElement===this.target){
            try{await this.document.exitFullscreen()}catch{/* The browser may already have exited. */}
        }
    }
    setEnabled(enabled:boolean){
        if(this.disposed)return
        this.enabled=enabled
        if(!enabled){if(this.pending)this.releaseOnSettle=true;else void this.release()}
    }
    dispose(){
        this.disposed=true
        if(!this.pending)void this.release()
    }
}
