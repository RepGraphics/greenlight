import {recommendLowerBitrate} from '../../../desktop/renderer/lib/bitrateadvisor'
import {validSessionBitrate} from '../../../desktop/renderer/lib/sessionquality'
import type {DiagnosticSample} from '../../../desktop/renderer/lib/streamdiagnostics'

// Advice is not live bitrate control. Use recent, sustained congestion only,
// and apply a lower cap exclusively to the next acknowledged session setup.
export function webQualityAdvice(samples:DiagnosticSample[],cap:number,elapsed:number,status:string):number|null{
    if(status!=='Connected'||!validSessionBitrate(cap)||!Number.isFinite(elapsed))return null
    const last=samples.at(-1)
    if(!last||last.statsFresh!==true||!Number.isFinite(last.elapsedSeconds)||elapsed<last.elapsedSeconds||elapsed-last.elapsedSeconds>5)return null
    const recommendation=recommendLowerBitrate(samples,cap)
    return recommendation!==null&&validSessionBitrate(recommendation)&&recommendation>0&&(cap===0||recommendation<cap)?recommendation:null
}
