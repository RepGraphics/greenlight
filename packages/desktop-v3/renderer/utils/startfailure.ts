import type {startupFailureReasons} from '../../../desktop/renderer/lib/streamdiagnostics'

export type StartFailureReason = typeof startupFailureReasons[number]

export class StreamStartFailure extends Error {
    constructor(readonly reason: StartFailureReason) {
        super(reason)
    }
}

export function startFailureReason(cause: unknown): StartFailureReason {
    if (cause instanceof StreamStartFailure) return cause.reason
    const error = cause as {data?: {code?: unknown}; cause?: {code?: unknown}; code?: unknown} | null
    switch (error?.data?.code ?? error?.cause?.code ?? error?.code) {
        case 'UNAUTHORIZED':
        case 'FORBIDDEN': return 'start-authorization'
        case 'BAD_REQUEST':
        case 'NOT_FOUND': return 'start-target'
        case 'CONFLICT': return 'start-conflict'
        case 'TOO_MANY_REQUESTS': return 'start-busy'
        default: return 'start-unconfirmed'
    }
}

export const startFailureDetails: Record<StartFailureReason, {message: string; canReturnToSetup: boolean}> = {
    'start-authorization': {message: 'Xbox rejected the stream credentials. Go back and reopen your Xbox account before trying again.', canReturnToSetup: false},
    'start-target': {message: 'Xbox rejected the selected streaming target. Refresh the console or game list before trying again.', canReturnToSetup: false},
    'start-region': {message: 'Xbox returned no usable default streaming region. Reopen your Xbox account to refresh it.', canReturnToSetup: false},
    'start-conflict': {message: 'Xbox reported a session conflict. End the existing stream before starting another.', canReturnToSetup: false},
    'start-busy': {message: 'Xbox is limiting new requests. Wait a moment, then try again from stream setup.', canReturnToSetup: true},
    'start-unconfirmed': {message: 'Greenlight couldn’t confirm whether Xbox started a session. Check for an active stream before trying again.', canReturnToSetup: false},
}
