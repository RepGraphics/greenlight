type FullscreenDocument=Pick<Document,'fullscreenEnabled'|'fullscreenElement'|'exitFullscreen'>
type FullscreenTarget=Pick<HTMLElement,'requestFullscreen'|'isConnected'>

export class WebFullscreen {
    private owned=false
    private pending=false
    private disposed=false
    constructor(private document:FullscreenDocument,private target:FullscreenTarget){}
    state(){
        const active=this.document.fullscreenElement===this.target
        const available=active?typeof this.document.exitFullscreen==='function':
            !this.document.fullscreenElement&&this.document.fullscreenEnabled===true&&this.target.isConnected&&typeof this.target.requestFullscreen==='function'
        return {active,available:!this.disposed&&Boolean(available),busy:this.pending}
    }
    async toggle(){
        if(this.disposed||this.pending)return false
        if(!this.state().available)throw Error('Fullscreen unavailable')
        this.pending=true
        try{
            if(this.document.fullscreenElement===this.target){
                await this.document.exitFullscreen()
                this.owned=false
            }else{
                await this.target.requestFullscreen()
                this.owned=this.document.fullscreenElement===this.target
            }
            return !this.disposed
        }finally{
            this.pending=false
            if(this.disposed)await this.release()
        }
    }
    private async release(){
        const owned=this.owned
        this.owned=false
        if(owned&&this.document.fullscreenElement===this.target){
            try{await this.document.exitFullscreen()}catch{/* The browser may already have exited. */}
        }
    }
    dispose(){
        this.disposed=true
        if(!this.pending)void this.release()
    }
}
