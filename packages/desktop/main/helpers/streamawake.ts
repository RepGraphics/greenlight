export interface PowerBlocker { start:(type:'prevent-display-sleep')=>number; stop:(id:number)=>void; isStarted:(id:number)=>boolean }
// One short renewable lease; crash or lost IPC cannot keep the host awake indefinitely.
export class StreamAwake {
    private id:number|undefined
    private timer:ReturnType<typeof setTimeout>|undefined
    private owner=''
    constructor(private blocker:PowerBlocker,private duration=45000){}
    renew(session:string){
        if(!session)return false
        if(this.owner&&this.owner!==session)this.release()
        if(this.id===undefined||!this.blocker.isStarted(this.id))this.id=this.blocker.start('prevent-display-sleep')
        this.owner=session
        clearTimeout(this.timer)
        this.timer=setTimeout(()=>this.release(session),this.duration)
        return true
    }
    release(session?:string){
        if(session!==undefined&&session!==this.owner)return
        clearTimeout(this.timer)
        this.timer=undefined
        if(this.id!==undefined&&this.blocker.isStarted(this.id))this.blocker.stop(this.id)
        this.id=undefined
        this.owner=''
    }
}
