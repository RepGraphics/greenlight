import { TokenStore } from 'xal-node'
import Store from 'electron-store'
import { safeStorage } from 'electron'

const encryptedKey = 'user.encryptedTokenstore'
const legacyKey = 'user.tokenstore'

export default class AuthTokenStore extends TokenStore {
    private _store = new Store()

    private canEncrypt() {
        return safeStorage.isEncryptionAvailable() &&
            (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')
    }

    load() {
        try {
            const encrypted = this._store.get(encryptedKey)
            if (typeof encrypted === 'string') {
                if (!this.canEncrypt()) return false
                this.loadJson(safeStorage.decryptString(Buffer.from(encrypted, 'base64')))
                this._store.delete(legacyKey)
                return true
            }
            const legacy = this._store.get(legacyKey)
            if (typeof legacy === 'string') {
                this.loadJson(legacy)
                if (this.canEncrypt()) this.save()
            }
            return true
        } catch {
            console.warn('Unable to load saved Xbox authentication. Sign in again if necessary.')
            this._userToken = undefined
            this._sisuToken = undefined
            this._jwtKeys = undefined
            return false
        }
    }

    save() {
        const data = JSON.stringify({
            userToken: this._userToken?.data,
            sisuToken: this._sisuToken?.data,
            jwtKeys: this._jwtKeys,
        })
        if (this.canEncrypt()) {
            this._store.set(encryptedKey, safeStorage.encryptString(data).toString('base64'))
            this._store.delete(legacyKey)
        } else {
            // Preserve an existing legacy session, but do not write fresh credentials unencrypted.
            console.warn('OS credential encryption unavailable; updated Xbox credentials will not be persisted.')
        }
    }

    clear() {
        this._store.delete(legacyKey)
        this._store.delete(encryptedKey)
        this._userToken = undefined
        this._sisuToken = undefined
        this._jwtKeys = undefined
    }

    removeAll() {
        this.clear()
    }
}
