import { ipcMain } from 'electron'
import { appRouter, createCallerFactory } from '@greenlight/platform'
import type {TrustedFrame} from './desktop-services'

const createCaller = createCallerFactory(appRouter)

export function setupTrpcHandler(trusted: TrustedFrame, streamRefreshToken: (type: 'home' | 'cloud', token: string) => string) {
  ipcMain.handle('trpc', async (event, op: {
    path: string
    type: 'query' | 'mutation'
    input: unknown
  }) => {
    try {
      if (!trusted(event) || typeof op?.path !== 'string' || op.path.startsWith('auth_')
          || !Object.hasOwn(appRouter._def.procedures, op.path)) throw Error('Greenlight request unavailable.')
      const caller = createCaller({})
      let input = op.input
      if (op.path === 'streaming_start_stream' || op.path === 'streaming_send_msal_token') {
        const exchange = input as {xCloudStreamConfig?: {type?: unknown}; token?: {token?: unknown}} | null
        const type = exchange?.xCloudStreamConfig?.type
        const streamToken = exchange?.token?.token
        if ((type !== 'home' && type !== 'cloud') || typeof streamToken !== 'string') {
          throw Object.assign(Error('Invalid Xbox stream.'), {code: 'BAD_REQUEST'})
        }
        let refreshToken: string
        try {refreshToken = streamRefreshToken(type, streamToken)}
        catch {throw Object.assign(Error('Xbox stream authorization failed.'), {code: 'UNAUTHORIZED'})}
        if (op.path === 'streaming_send_msal_token') input = {...exchange, refreshToken}
      }
      const fn = caller[op.path as keyof typeof caller] as (input: unknown) => Promise<unknown>
      const data = await fn(input)
      return { result: { data } }
    } catch (cause: unknown) {
      const error = cause as Error & { code?: string }
      if (op?.path === 'streaming_start_stream') {
        console.warn('V3 Xbox stream startup rejected', error.code ?? 'UNCONFIRMED')
      }
      return {
        error: {
          message: op?.path === 'streaming_send_msal_token' ? 'Xbox stream authorization failed.' : error.message ?? 'Internal server error',
          code: error.code ?? 'INTERNAL_SERVER_ERROR',
        },
      }
    }
  })
}
