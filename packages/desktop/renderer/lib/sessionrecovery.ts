// Only retry console sessions automatically after a previously established connection.
export function recoveryDelay(enabled:boolean, cloud:boolean, connected:boolean, failures:number):number|null {
    if(!enabled || cloud || !connected || !Number.isInteger(failures) || failures<0 || failures>=2) return null
    return [3000,8000][failures]
}
