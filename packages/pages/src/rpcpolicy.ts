export function isRpcPath(path:string){return path==='/trpc'||path.startsWith('/trpc/')}
export function rpcRequestAllowed(method:string,search:string){
    // tRPC clients may include ?batch=1, but never credentials in query input.
    return method==='POST'&&(search===''||search==='?batch=1')
}
export const rpcHeaders={'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}
