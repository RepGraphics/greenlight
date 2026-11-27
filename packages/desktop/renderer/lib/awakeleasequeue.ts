type Send=(enabled:boolean)=>Promise<unknown>
type Schedule=(callback:()=>void,delay:number)=>ReturnType<typeof setInterval>
type Cancel=(timer:ReturnType<typeof setInterval>)=>void

// Order writes for the same session across React effect replacement. Otherwise
// a late cleanup from an earlier renewal can revoke a newer active lease.
export class AwakeLeaseQueue {
    private tails=new Map<string,Promise<void>>()
    constructor(private schedule:Schedule=setInterval.bind(globalThis),private cancel:Cancel=clearInterval.bind(globalThis)){}
    private enqueue(session:string,operation:()=>Promise<unknown>){
        const previous=this.tails.get(session)??Promise.resolve()
        const next=previous.then(operation).then(()=>{},()=>{})
        this.tails.set(session,next)
        void next.then(()=>{if(this.tails.get(session)===next)this.tails.delete(session)})
        return next
    }
    start(session:string,send:Send){
        let disposed=false
        let pending=false
        const renew=()=>{
            if(disposed||pending)return
            pending=true
            void this.enqueue(session,async()=>{if(!disposed)await send(true)}).then(()=>{pending=false})
        }
        renew()
        const timer=this.schedule(renew,15000)
        return ()=>{
            if(disposed)return
            disposed=true
            this.cancel(timer)
            void this.enqueue(session,()=>send(false))
        }
    }
}
