import {ipcMain, safeStorage, type IpcMainInvokeEvent} from 'electron'
import Store from 'electron-store'
import {appRouter, createCallerFactory, XboxAuthController} from '@greenlight/platform'
import {DesktopAccounts, type StoredXboxAccount} from './accounts'
import {normalizeStreamPreferences, type StreamPreferences} from '../shared/streampreferences'

export type TrustedFrame = (event: IpcMainInvokeEvent) => boolean

export function setupDesktopServices(trusted: TrustedFrame) {
    const settings = new Store<{preferences: StreamPreferences}>({name: 'v3-preferences'})
    const accounts = new Store<{accounts: StoredXboxAccount[]}>({name: 'v3-accounts'})
    const xboxAuth = new XboxAuthController()
    const xbox = createCallerFactory(appRouter)({})
    const manager = new DesktopAccounts<Awaited<ReturnType<XboxAuthController['refreshSavedAccount']>>>({
        start: () => xboxAuth.startMsalAuth(),
        verify: code => xboxAuth.verifyDeviceCode(code),
        refresh: token => xboxAuth.refreshSavedAccount(token),
        session: token => xboxAuth.getDesktopSession(token),
        profile: async credentials => {
            const response = await xbox.profile_get_current(credentials)
            const person = response.data?.profileUsers?.[0]
            if (typeof person?.id !== 'string' || !/^\d{1,20}$/.test(person.id)) return null
            const value = (id: string) => person.settings?.find(setting => setting.id === id)?.value
            return {id: person.id, name: value('Gamertag') ?? value('GameDisplayName') ?? 'Xbox account', avatar: value('GameDisplayPicRaw')}
        },
        // Windows is the supported persistent-account target for this preview.
        canSave: () => process.platform === 'win32' ? safeStorage.isAsyncEncryptionAvailable() : Promise.resolve(false),
        encrypt: async value => (await safeStorage.encryptStringAsync(value)).toString('base64'),
        decrypt: async value => (await safeStorage.decryptStringAsync(Buffer.from(value, 'base64'))).result,
        read: () => {
            const entries = accounts.get('accounts', [])
            if (!Array.isArray(entries)) return []
            return entries.filter(entry => entry && typeof entry.id === 'string' && typeof entry.name === 'string'
                && typeof entry.encryptedRefreshToken === 'string' && entry.encryptedRefreshToken.length <= 32768)
        },
        write: value => accounts.set('accounts', value),
    })

    const handle = (channel: string, operation: (value: unknown) => unknown) => {
        ipcMain.handle(channel, async (event, value: unknown) => {
            if (!trusted(event)) throw Error('Untrusted Greenlight window.')
            try {
                return await operation(value)
            } catch {
                throw Error('Greenlight could not complete this operation.')
            }
        })
    }
    const id = (value: unknown) => {
        if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw Error('Invalid account.')
        return value
    }

    handle('desktop:preferences:load', () => settings.has('preferences') ? normalizeStreamPreferences(settings.get('preferences')) : null)
    handle('desktop:preferences:save', value => settings.set('preferences', normalizeStreamPreferences(value)))
    handle('desktop:accounts:list', () => manager.list())
    handle('desktop:accounts:start', () => manager.start())
    handle('desktop:accounts:finish', () => manager.finish())
    handle('desktop:accounts:open', value => manager.open(id(value)))
    handle('desktop:accounts:remove', value => manager.remove(id(value)))
    handle('desktop:accounts:cancel', () => manager.cancel())
    return manager
}
