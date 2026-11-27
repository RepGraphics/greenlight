import { Msal } from 'xal-node'
import ProxyStore from '../utils/proxystore.js'
import { IUserToken } from 'xal-node/dist/lib/tokens/usertoken.js'

export default class authController {

    async startMsalAuth() {
        const tokenStore = new ProxyStore();
        const msal = new Msal(tokenStore)
        return await msal.doDeviceCodeAuth()
    }

    async verifyDeviceCode(devicecode:string, timeout?:number) {
        const tokenStore = new ProxyStore();
        const msal = new Msal(tokenStore)
        return await msal.doPollForDeviceCodeAuth(devicecode, timeout)
    }

    async refreshUserToken(token:IUserToken) {
        const tokenStore = new ProxyStore(token);
        const msal = new Msal(tokenStore)
        return await msal.refreshUserToken()
    }

    async getStreamingTokens(token:IUserToken) {
        const tokenStore = new ProxyStore(token);
        const msal = new Msal(tokenStore)
        return this.getXboxStreamingTokens(msal)
    }

    private async getXboxStreamingTokens(msal: Msal) {
        const gssvToken = await msal.getGssvToken()

        if(gssvToken === undefined){
            throw new Error('No gssv token found. Please authenticate first.')
        }

        const _xhomeToken = await msal.getStreamToken(gssvToken.data.Token, 'xhome')

        let _xcloudToken:typeof _xhomeToken|undefined
        try {
            _xcloudToken = await msal.getStreamToken(gssvToken.data.Token, 'xgpuweb')
        } catch(error){
            try {
                _xcloudToken = await msal.getStreamToken(gssvToken.data.Token, 'xgpuwebf2p')
            }
            catch(error){
                console.log('Failed to retrieve xCloud token. (Also F2P. Cloud gaming down?)')
            }
        }

        return { xHomeToken: _xhomeToken, xCloudToken: _xcloudToken }
    }

    async getWebToken(token:IUserToken) {
        const tokenStore = new ProxyStore(token);
        const msal = new Msal(tokenStore)
        return await msal.getWebToken()
    }

    async refreshSavedAccount(refreshToken: string) {
        const store = new ProxyStore({refresh_token: refreshToken, access_token: '', scope: '', token_type: 'Bearer', expires_in: 0})
        return (await new Msal(store).refreshUserToken()).data
    }

    async getDesktopSession(token: IUserToken) {
        // MSAL returns expires_in on fresh exchanges. Give xal-node the
        // equivalent absolute expiry so it doesn't refresh each Xbox request.
        const expires = Date.now() + Math.max(0, token.expires_in) * 1000
        const expiresOn = Number.isFinite(expires) && expires <= 8640000000000000 ? new Date(expires).toISOString() : undefined
        const store = new ProxyStore({...token, expires_on: expiresOn})
        const msal = new Msal(store)
        const webToken = await msal.getWebToken()
        const streamingTokens = await this.getXboxStreamingTokens(msal).catch(() => null)
        return {webToken, streamingTokens, refreshToken: store.getUserToken()?.data.refresh_token || token.refresh_token}
    }
}
