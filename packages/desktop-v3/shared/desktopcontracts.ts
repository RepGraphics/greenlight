import type {StreamPreferences} from './streampreferences'
import type {RouterOutputs} from '../renderer/utils/trpc'

export interface XboxAccount {
    id: string
    name: string
    avatar?: string
}

export interface DesktopSession {
    account: XboxAccount | null
    saved: boolean
    webToken: RouterOutputs['auth_get_webtoken']
    streamingTokens: RouterOutputs['auth_get_streamingtokens'] | null
}

export interface DeviceCodePrompt {
    user_code: string
    verification_uri: string
}

export interface DesktopBridge {
    preferences: {
        load: () => Promise<StreamPreferences | null>
        save: (value: StreamPreferences) => Promise<void>
    }
    accounts: {
        list: () => Promise<{available: boolean; accounts: XboxAccount[]}>
        start: () => Promise<DeviceCodePrompt>
        finish: () => Promise<DesktopSession>
        open: (id: string) => Promise<DesktopSession>
        remove: (id: string) => Promise<void>
        cancel: () => Promise<void>
    }
}
