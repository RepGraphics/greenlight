const defaultDeviceSignIn = 'https://microsoft.com/devicelogin'
const xboxDeviceSignIn = 'https://www.microsoft.com/link'

export function deviceSignInUrl(value: unknown) {
    if (typeof value !== 'string') return defaultDeviceSignIn
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
            return defaultDeviceSignIn
        }
        if ((url.hostname === 'microsoft.com' || url.hostname === 'www.microsoft.com') && /^\/link\/?$/.test(url.pathname)) {
            return xboxDeviceSignIn
        }
    } catch {
        return defaultDeviceSignIn
    }
    return defaultDeviceSignIn
}

export function isDeviceSignInUrl(url: string) {
    return url === defaultDeviceSignIn || url === xboxDeviceSignIn
}

export const deviceCodeSetupTimeoutMs=30000
export function deviceCodeDetails(value:unknown,requiresSecret:boolean){
    if(!value||typeof value!=='object'||Array.isArray(value))return null
    const flow=value as Record<string,unknown>
    if(typeof flow.user_code!=='string'||!/^[A-Za-z0-9-]{4,32}$/.test(flow.user_code))return null
    const secret=flow.device_code
    if(requiresSecret&&(typeof secret!=='string'||secret.length===0||secret.length>8192||/[\x00-\x20\x7f]/.test(secret)))return null
    const expires=flow.expires_in??900
    if(typeof expires!=='number'||!Number.isInteger(expires)||expires<=0||expires>3600)return null
    return {user_code:flow.user_code,verification_uri:deviceSignInUrl(flow.verification_uri),expires_in:expires,device_code:requiresSecret?secret as string:undefined}
}
export function deviceCodeRemaining(deadline:number,now:number){
    if(!Number.isFinite(deadline)||!Number.isFinite(now))return 0
    return Math.max(0,Math.min(3600,Math.ceil((deadline-now)/1000)))
}
