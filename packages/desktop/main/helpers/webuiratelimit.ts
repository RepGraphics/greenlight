import { performance } from 'node:perf_hooks'

// Fixed memory, monotonic clock and a continuously replenished request budget.
// consume() returns zero for an accepted request, or seconds until a retry.
export class TokenBucket {
    private tokens:number
    private updated:number
    constructor(private capacity:number,private perSecond:number,private now:()=>number=()=>performance.now()){
        if(!Number.isFinite(capacity)||capacity<1||!Number.isFinite(perSecond)||perSecond<=0)throw new Error('Invalid rate limit')
        this.tokens=capacity
        this.updated=now()
    }
    consume():number{
        const current=this.now()
        const elapsed=Math.max(0,current-this.updated)
        this.updated=Math.max(this.updated,current)
        this.tokens=Math.min(this.capacity,this.tokens+elapsed*this.perSecond/1000)
        if(this.tokens>=1){this.tokens--;return 0}
        return Math.max(1,Math.ceil((1-this.tokens)/this.perSecond))
    }
}

interface RateResponse {
    setHeader(name:string,value:string):unknown
    status(code:number):{send(message:string):unknown}
}
export function createWebUiRateLimiter(budget:TokenBucket){
    return (_request:unknown,response:RateResponse,next:()=>void)=>{
        response.setHeader('Cache-Control','no-store')
        const retryAfter=budget.consume()
        if(retryAfter>0){
            response.setHeader('Retry-After',String(retryAfter))
            response.status(429).send('Too many requests')
            return
        }
        next()
    }
}
