import {Address6} from 'ip-address'

interface XboxIceCandidate {
    candidate: string
    sdpMid?: string | null
    sdpMLineIndex?: number | string | null
    messageType?: string
}

export function xboxIceAnswer(exchange: unknown, home: boolean) {
    if (typeof exchange !== 'string') throw Error('Invalid Xbox ICE response')
    let parsed: unknown
    try {parsed = JSON.parse(exchange)} catch {throw Error('Invalid Xbox ICE response')}
    if (!Array.isArray(parsed) || parsed.length > 256) throw Error('Invalid Xbox ICE response')
    const candidates = parsed.filter((entry): entry is XboxIceCandidate => typeof entry?.candidate === 'string')
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
            if (!port || known.has(key)) continue
            known.add(key)
            fallbacks.push({...entry, candidate: `candidate:${10 + index} 1 UDP 1 ${teredo.client4} ${port} typ host`})
        }
    }
    return [...routes, ...fallbacks, ...endMarkers]
}
