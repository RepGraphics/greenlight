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
      if (op.path === 'streaming_send_msal_token') {
        const exchange = input as {xCloudStreamConfig?: {type?: unknown}; token?: {token?: unknown}} | null
        const type = exchange?.xCloudStreamConfig?.type
        const streamToken = exchange?.token?.token
        if ((type !== 'home' && type !== 'cloud') || typeof streamToken !== 'string') throw Error('Invalid Xbox stream.')
        input = {...exchange, refreshToken: streamRefreshToken(type, streamToken)}
      }
      const fn = caller[op.path as keyof typeof caller] as (input: unknown) => Promise<unknown>
      const data = await fn(input)
      return { result: { data } }
    } catch (cause: unknown) {
      const error = cause as Error & { code?: string }
      return {
        error: {
          message: op?.path === 'streaming_send_msal_token' ? 'Xbox stream authorization failed.' : error.message ?? 'Internal server error',
          code: error.code ?? 'INTERNAL_SERVER_ERROR',
        },
      }
    }
  })
}
