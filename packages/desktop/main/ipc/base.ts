import Application from '../application'

interface EventArgs {
    action: string;
    id: number;
    data: any;
    error?: any;
}

const allowed: Record<string, string[]> = {
    app: ['loadCachedUser', 'getAuthState', 'login', 'quit', 'restart', 'clearData', 'getOnlineFriends', 'onUiShown', 'setForceRegionIp', 'setPreferredGameLanguage', 'debug'],
    settings: ['setSettings', 'getSettings', 'getWebUIStatus', 'getWebUIAccessToken', 'startWebUI', 'stopWebUI', 'setLowResolution'],
    consoles: ['get'],
    xCloud: ['getRecentTitles', 'getTitles', 'filterTitles', 'getNewTitles', 'getTitle'],
    streaming: ['startStream', 'stopStream', 'sendSdp', 'sendChatSdp', 'sendIce', 'sendKeepalive', 'getPlayerState', 'activeSessions'],
}

export default class IpcBase {
    _application: Application

    constructor(application: Application) {
        this._application = application
    }

    async onEvent(channel, event, args: EventArgs, reply?: (args: EventArgs) => void) {
        if (!args || typeof args.action !== 'string' || !Number.isSafeInteger(args.id)) return
        const respond = (data: EventArgs) => {
            if (reply) reply(data)
            else if (event?.sender && !event.sender.isDestroyed()) event.sender.send(channel, data)
            else this.send(channel, data)
        }
        try {
            if (!Object.prototype.hasOwnProperty.call(allowed, channel) || !allowed[channel].includes(args.action) || typeof this[args.action] !== 'function') {
                throw new Error('Unsupported IPC action')
            }
            const result = await this[args.action](args.data ?? {})
            respond({ action: args.action, id: args.id, data: result })
        } catch (error) {
            const status = typeof error?.status === 'number' ? error.status : undefined
            respond({ action: args.action, id: args.id, data: {}, error: { name: error?.name || 'Error', message: error instanceof Error ? error.message : 'Application request failed', status } })
        }
    }

    send(channel, args: EventArgs) {
        const contents = this._application._mainWindow?.webContents
        if (contents && !contents.isDestroyed()) contents.send(channel, args)
    }
}
