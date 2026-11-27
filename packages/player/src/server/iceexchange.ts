import {Address6} from 'ip-address'

interface XboxIceCandidate {
    candidate: string
    sdpMid?: string | null
    sdpMLineIndex?: number | string | null
    messageType?: string
    usernameFragment?: string | null
}

export const iceCandidateLimit=256
const iceAnswerLimit=1024*1024
// Preserve the Xbox wire format while allowing only bounded RTC fields.
export function validateXboxIceCandidates(value:unknown):XboxIceCandidate[]{
    if(!Array.isArray(value)||value.length>iceCandidateLimit)throw Error('Invalid Xbox ICE candidates')
    return value.map(entry=>{
        if(!entry||typeof entry!=='object'||Array.isArray(entry)||typeof entry.candidate!=='string'||entry.candidate.length>4096||/[\x00-\x1f\x7f]/.test(entry.candidate))throw Error('Invalid Xbox ICE candidates')
        const line=entry.candidate.trim()
        if(line&&!/^(?:a=)?(?:candidate:|end-of-candidates$)/.test(line))throw Error('Invalid Xbox ICE candidates')
        const result:XboxIceCandidate={candidate:entry.candidate}
        if(entry.sdpMid!==undefined){
            if(entry.sdpMid!==null&&(typeof entry.sdpMid!=='string'||entry.sdpMid.length>64||/[\x00-\x20\x7f]/.test(entry.sdpMid)))throw Error('Invalid Xbox ICE candidates')
            result.sdpMid=entry.sdpMid
        }
        if(entry.sdpMLineIndex!==undefined){
            const index=entry.sdpMLineIndex
            if(index!==null&&!(typeof index==='number'&&Number.isInteger(index)&&index>=0&&index<=65535)&&!(typeof index==='string'&&/^\d{1,5}$/.test(index)&&Number(index)<=65535))throw Error('Invalid Xbox ICE candidates')
            result.sdpMLineIndex=index
        }
        if(entry.usernameFragment!==undefined){
            if(entry.usernameFragment!==null&&(typeof entry.usernameFragment!=='string'||entry.usernameFragment.length>256||/[\x00-\x20\x7f]/.test(entry.usernameFragment)))throw Error('Invalid Xbox ICE candidates')
            result.usernameFragment=entry.usernameFragment
        }
        if(entry.messageType!==undefined){
            if(entry.messageType!=='iceCandidate')throw Error('Invalid Xbox ICE candidates')
            result.messageType=entry.messageType
        }
        return result
    })
}

export function xboxIceAnswer(exchange: unknown, home: boolean) {
    if (typeof exchange !== 'string'||exchange.length>iceAnswerLimit) throw Error('Invalid Xbox ICE response')
    let parsed: unknown
    try {parsed = JSON.parse(exchange)} catch {throw Error('Invalid Xbox ICE response')}
    let candidates:XboxIceCandidate[]
    try{candidates=validateXboxIceCandidates(parsed)}catch{throw Error('Invalid Xbox ICE response')}
    const isEnd = (entry: XboxIceCandidate) => /^\s*(?:(?:a=)?end-of-candidates)?\s*$/.test(entry.candidate)
    const routes = candidates.filter(entry => !isEnd(entry))
    const endMarkers = candidates.filter(isEnd)
    if (!home) return [...routes, ...endMarkers]

    // Console sessions can advertise Teredo. Keep the original route and
    // add the IPv4 endpoints used by the established desktop Remote Play path.
    const known = new Set(routes.map(entry => {
        const parts = entry.candidate.trim().split(/\s+/)
        return `${parts[1]} ${parts[2]?.toLowerCase()} ${parts[4]} ${parts[5]}`
    }))
    const fallbacks: XboxIceCandidate[] = []
    for (const entry of routes) {
        const fields = entry.candidate.trim().split(/\s+/)
        const address = fields[4]
        if (fields[1] !== '1' || fields[2]?.toLowerCase() !== 'udp' || !address || !Address6.isValid(address)) continue
        const ipv6 = new Address6(address)
        if (!ipv6.isTeredo()) continue
        const teredo = ipv6.inspectTeredo()
        for (const [index, port] of [9002, Number(teredo.udpPort)].entries()) {
            const key = `1 udp ${teredo.client4} ${port}`
            if (!Number.isInteger(port)||port<1||port>65535||known.has(key)||routes.length+endMarkers.length+fallbacks.length>=iceCandidateLimit) continue
            known.add(key)
            fallbacks.push({...entry, candidate: `candidate:${10 + index} 1 UDP 1 ${teredo.client4} ${port} typ host`})
        }
    }
    return [...routes, ...fallbacks, ...endMarkers]
}
