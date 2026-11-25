type SessionRef={current:string}

// One remote stop per owned session; clear ownership only on acknowledgement.
export class ClassicSessionExit {
    private pending=new Map<string,Promise<boolean>>()
    get busy(){return this.pending.size>0}
    stop(owner:SessionRef,request:(id:string)=>Promise<unknown>):Promise<boolean>{
        const id=owner.current
        if(!id)return Promise.resolve(true)
        const existing=this.pending.get(id)
        if(existing)return existing
        const operation=Promise.resolve().then(()=>request(id)).then(()=>{
            if(owner.current===id)owner.current=''
            return true
        },()=>false).finally(()=>{this.pending.delete(id)})
        this.pending.set(id,operation)
        return operation
    }
}
