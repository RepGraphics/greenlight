// Keep the sign-in destination independent of upstream response text/URLs.
export const microsoftDeviceLogin='https://microsoft.com/devicelogin'
export const deviceLoginSetupTimeoutMs=30000
export type DeviceLogin={userCode:string;deviceCode:string;expiresIn:number}
export function readDeviceLogin(value:unknown):DeviceLogin|null{
    if(!value||typeof value!=='object'||Array.isArray(value))return null
    const flow=value as Record<string,unknown>
    if(typeof flow.user_code!=='string'||!/^[A-Za-z0-9-]{4,32}$/.test(flow.user_code)||
        typeof flow.device_code!=='string'||flow.device_code.length===0||flow.device_code.length>8192||/[\x00-\x20\x7f]/.test(flow.device_code))return null
    // Microsoft normally supplies a 900-second expiry. Older responses may omit it.
    const expires=flow.expires_in??900
    if(typeof expires!=='number'||!Number.isInteger(expires)||expires<=0||expires>3600)return null
    return {userCode:flow.user_code,deviceCode:flow.device_code,expiresIn:expires}
}
export function remainingDeviceLoginSeconds(deadline:number,now:number){
    if(!Number.isFinite(deadline)||!Number.isFinite(now))return 0
    return Math.max(0,Math.min(3600,Math.ceil((deadline-now)/1000)))
}
