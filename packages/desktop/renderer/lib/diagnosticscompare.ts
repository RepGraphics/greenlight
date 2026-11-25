import {summarizeDiagnostics} from './streamdiagnostics'
import type {DiagnosticSample} from './streamdiagnostics'
export function compareDiagnostics(baseline:DiagnosticSample[],current:DiagnosticSample[]){
    const before=summarizeDiagnostics(baseline),after=summarizeDiagnostics(current)
    const difference=(a:number|null,b:number|null)=>a===null||b===null?null:Math.round((b-a)*100)/100
    return {before,after,metrics:[
        {key:'averageFps',unit:'fps',before:before.averageFps,after:after.averageFps,delta:difference(before.averageFps,after.averageFps)},
        {key:'averageBitrate',unit:'Mbps',before:before.averageBitrate,after:after.averageBitrate,delta:difference(before.averageBitrate,after.averageBitrate)},
        {key:'rtt95',unit:'ms',before:before.rtt95,after:after.rtt95,delta:difference(before.rtt95,after.rtt95)},
        {key:'jitter95',unit:'ms',before:before.jitter95,after:after.jitter95,delta:difference(before.jitter95,after.jitter95)}
    ]}
}
