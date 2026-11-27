import {createHash} from 'node:crypto'
import type {DesktopSession, DeviceCodePrompt, XboxAccount} from '../shared/desktopcontracts'
import {xboxImage} from '../shared/xboxart'
import {deviceCodeDetails,deviceCodeRemaining} from '../shared/devicesignin'

export type StoredXboxAccount = XboxAccount & {encryptedRefreshToken: string}
type Tokens = Pick<DesktopSession, 'webToken' | 'streamingTokens'> & {refreshToken: string}

export interface AccountServices<UserToken> {
    start: () => Promise<DeviceCodePrompt & {device_code: string}>
    verify: (deviceCode: string) => Promise<UserToken>
    refresh: (refreshToken: string) => Promise<UserToken>
    session: (token: UserToken) => Promise<Tokens>
    profile: (credentials: {token: string; uhs: string}) => Promise<{id: string; name: string; avatar?: string} | null>
    canSave: () => Promise<boolean>
    encrypt: (value: string) => Promise<string>
    decrypt: (value: string) => Promise<string>
    read: () => StoredXboxAccount[]
    write: (value: StoredXboxAccount[]) => void
}

const accountLimit = 12
const accountId = (id: string) => createHash('sha256').update('Greenlight Xbox account '+id).digest('hex')
const devicePrompt = ({user_code, verification_uri, expires_in}: DeviceCodePrompt): DeviceCodePrompt => ({user_code, verification_uri, expires_in})
const accountSummary = ({id, name, avatar}: XboxAccount): XboxAccount => ({id, name, avatar: xboxImage(avatar)})

export class DesktopAccounts<UserToken> {
    private generation = 0
    private device?: {code: string; generation: number; deadline:number}
    private active?: Tokens

    constructor(private readonly service: AccountServices<UserToken>,private readonly now=()=>performance.now()) {}

    cancel() {
        this.generation++
        this.device = undefined
        this.active = undefined
    }

    private expectCurrent(generation: number) {
        if (generation !== this.generation) throw Error('Xbox sign-in cancelled.')
    }

    async list() {
        const available = await this.service.canSave().catch(() => false)
        return {available, accounts: this.service.read().map(accountSummary)}
    }

    async start() {
        this.cancel()
        const generation = this.generation
        const flow = await this.service.start()
        this.expectCurrent(generation)
        const details=deviceCodeDetails(flow,true)
        if(!details?.device_code)throw Error('Xbox sign-in code unavailable.')
        this.device={code:details.device_code,generation,deadline:this.now()+details.expires_in*1000}
        return devicePrompt(details)
    }

    async finish() {
        const device = this.device
        if (!device) throw Error('Start Xbox sign-in first.')
        this.device = undefined
        if(deviceCodeRemaining(device.deadline,this.now())===0)throw Error('Xbox sign-in code expired.')
        const token = await this.service.verify(device.code)
        this.expectCurrent(device.generation)
        return this.activate(token, device.generation)
    }

    async open(id: string) {
        this.cancel()
        const generation = this.generation
        const entry = this.service.read().find(account => account.id === id)
        if (!entry || !await this.service.canSave()) throw Error('Saved Xbox account is unavailable.')
        const refresh = await this.service.decrypt(entry.encryptedRefreshToken)
        this.expectCurrent(generation)
        const token = await this.service.refresh(refresh)
        this.expectCurrent(generation)
        return this.activate(token, generation, entry)
    }

    remove(id: string) {
        this.cancel()
        const entries = this.service.read()
        this.service.write(entries.filter(account => account.id !== id))
    }

    streamRefreshToken(type: 'home' | 'cloud', streamToken: string) {
        const active = this.active
        const authorized = type === 'cloud' ? active?.streamingTokens?.xCloudToken : active?.streamingTokens?.xHomeToken
        if (!active?.refreshToken || !authorized?.data.gsToken || streamToken !== authorized.data.gsToken) {
            throw Error('Xbox stream does not match the active account.')
        }
        return active.refreshToken
    }

    private async activate(token: UserToken, generation: number, previous?: StoredXboxAccount): Promise<DesktopSession> {
        const tokens = await this.service.session(token)
        this.expectCurrent(generation)
        const claim = tokens.webToken.data.DisplayClaims?.xui?.[0]
        const identity = claim?.uhs ? await this.service.profile({token: tokens.webToken.data.Token, uhs: claim.uhs}).catch(() => null) : null
        this.expectCurrent(generation)
        const verifiedId = identity?.id && /^\d{1,20}$/.test(identity.id) ? accountId(identity.id) : undefined
        if(previous&&!verifiedId)throw Error('Could not verify the saved Xbox account identity.')
        if (previous && verifiedId && previous.id !== verifiedId) throw Error('This Microsoft sign-in returned a different Xbox account.')
        const profile = identity && verifiedId ? {
            id: verifiedId, name: typeof identity.name==='string'?identity.name.trim().slice(0,64)||'Xbox account':'Xbox account',
            avatar: xboxImage(identity.avatar),
        } : previous ? accountSummary(previous) : null
        const saved = profile ? await this.save(profile, tokens.refreshToken, generation) : false
        this.expectCurrent(generation)
        this.active = tokens
        return {account: profile, saved, webToken: tokens.webToken, streamingTokens: tokens.streamingTokens}
    }

    private async save(profile: XboxAccount, refreshToken: string, generation: number) {
        if (!refreshToken || !await this.service.canSave().catch(() => false)) return false
        try {
            const encryptedRefreshToken = await this.service.encrypt(refreshToken)
            this.expectCurrent(generation)
            const entries = this.service.read()
            const index = entries.findIndex(account => account.id === profile.id)
            if (index < 0 && entries.length >= accountLimit) return false
            const entry = {...accountSummary(profile), encryptedRefreshToken}
            if (index < 0) entries.push(entry)
            else entries[index] = entry
            this.service.write(entries)
            return true
        } catch {
            this.expectCurrent(generation)
            return false
        }
    }
}
