// A cancelled or superseded authentication request must never restore
// credentials after logout, even if the upstream exchange cannot be aborted.
export class AuthAttempt {
    private generation=0
    private controller?:AbortController
    begin(){
        this.cancel()
        const controller=new AbortController()
        this.controller=controller
        const generation=this.generation
        return {signal:controller.signal,current:()=>generation===this.generation&&!controller.signal.aborted}
    }
    cancel(){
        this.generation++
        this.controller?.abort()
        this.controller=undefined
    }
}
export function clearLegacyUserToken(storage:()=>Pick<Storage,'removeItem'>){
    try{storage().removeItem('userToken')}catch{/* Storage can be disabled. Never read or restore the old token. */}
}
