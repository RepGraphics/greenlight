interface SessionAttempt {
    start:()=>Promise<unknown>
    stop:(sessionId:string)=>Promise<unknown>
    onSession:(sessionId:string)=>void
    onError:(reason:'start'|'stop')=>void
}

// Serialize provisioning and teardown, including sessions returned after a
// cancelled or timed-out attempt. A failed stop retains ownership for retry.
export class SessionLifecycle {
    private tail:Promise<void>=Promise.resolve()
    private active:{id:string;owner:object;stop:SessionAttempt['stop']}|undefined
    constructor(private schedule=setTimeout,private cancel=clearTimeout,private timeoutMs=60000){}
    private enqueue(operation:()=>Promise<void>){
        this.tail=this.tail.then(operation).catch(()=>{})
    }
    private async closeActive(){
        const session=this.active
        if(!session)return
        await session.stop(session.id)
        if(this.active===session)this.active=undefined
    }
    begin(attempt:SessionAttempt){
        const owner={}
        let disposed=false
        let timer:ReturnType<typeof setTimeout>|undefined
        const clear=()=>{if(timer!==undefined){this.cancel(timer);timer=undefined}}
        const dispose=()=>{
            if(disposed)return
            disposed=true;clear()
            this.enqueue(async()=>{if(this.active?.owner===owner)await this.closeActive()})
        }
        this.enqueue(async()=>{
            if(disposed)return
            try{await this.closeActive()}
            catch{if(!disposed)attempt.onError('stop');return}
            if(disposed)return
            timer=this.schedule(()=>{if(!disposed){dispose();attempt.onError('start')}},this.timeoutMs)
            let result:unknown
            try{
                result=await attempt.start()
                if(typeof result!=='string'||!result)throw Error('Invalid session identifier')
            }catch{
                if(!disposed)attempt.onError('start')
                return
            }finally{clear()}
            this.active={id:result as string,owner,stop:attempt.stop}
            if(!disposed)attempt.onSession(result as string)
        })
        return dispose
    }
}
