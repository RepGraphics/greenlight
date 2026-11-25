import IpcBase from './base'
import { session } from 'electron'
import electron from 'electron'
import { exportCaptureFile,validateCaptureExport } from '../helpers/captureexport'
import { isAbsolute } from 'node:path'
import { checkForkUpdates } from '../helpers/updater'

interface setForceRegionIpArgs {
    ip:string;
}

interface setPreferredGameLanguageArgs {
    language:string;
}

export default class IpcApp extends IpcBase {
    // _streamingSessions:any = {}

    private captureExportBusy=false

    getCaptureDirectory(){
        const value=this._application._store.get('captureExport.directory')
        return typeof value==='string'&&isAbsolute(value)?value:null
    }

    async chooseCaptureDirectory(){
        if(this.captureExportBusy)throw Error('Capture export busy')
        this.captureExportBusy=true
        try{
            const result=await electron.dialog.showOpenDialog(this._application._mainWindow,{properties:['openDirectory','createDirectory'],defaultPath:this.getCaptureDirectory()??electron.app.getPath('videos')})
            if(result.canceled||!result.filePaths[0])return this.getCaptureDirectory()
            const directory=result.filePaths[0]
            if(!isAbsolute(directory))throw Error('Invalid capture directory')
            this._application._store.set('captureExport.directory',directory)
            return directory
        }finally{this.captureExportBusy=false}
    }

    clearCaptureDirectory(){
        if(this.captureExportBusy)throw Error('Capture export busy')
        this._application._store.delete('captureExport.directory')
        return null
    }

    async exportCapture(args:unknown){
        if(this.captureExportBusy)throw Error('Capture export busy')
        const directory=this.getCaptureDirectory()
        if(!directory)throw Error('Choose a capture folder first')
        const capture=validateCaptureExport(args)
        this.captureExportBusy=true
        try{return {name:await exportCaptureFile(directory,capture)}}
        finally{this.captureExportBusy=false}
    }

    checkForUpdates(args:{includePrereleases?:boolean}={}){
        return checkForkUpdates(args?.includePrereleases===true)
    }

    loadCachedUser(){
        return new Promise((resolve) => {
            const user = this.getUserState()

            resolve(user)
        })
    }

    getUserState(){
        const gamertag = this._application._store.get('user.gamertag')
        const gamerpic = this._application._store.get('user.gamerpic')
        const gamerscore = this._application._store.get('user.gamerscore')

        return {
            signedIn: gamertag ? true : false,
            type: 'user',
            gamertag: gamertag ? gamertag : '',
            gamerpic: gamerpic ? gamerpic : '',
            gamerscore: gamerscore ? gamerscore : '',
            level: this._application._authentication._appLevel,
        }
    }

    getAuthState(){
        return new Promise((resolve) => {
            resolve({
                isAuthenticating: this._application._authentication._isAuthenticating,
                isAuthenticated: this._application._authentication._isAuthenticated,
                user: this.getUserState(),
            })
        })
    }

    login(){
        return new Promise<boolean>((resolve) => {
            this._application._authentication.startAuthflow()
            resolve(true)
        })
    }

    quit(){
        return new Promise<boolean>((resolve) => {
            resolve(true)
            setTimeout(() => {
                this._application.quit()
            }, 100)
        })
    }

    restart(){
        return new Promise<boolean>((resolve) => {
            resolve(true)
            setTimeout(() => {
                this._application.restart()
            }, 100)
        })
    }

    clearData(){
        return new Promise<boolean>((resolve, reject) => {
            session.defaultSession.clearStorageData().then(() => {
                this._application._authentication._tokenStore.clear()
                this._application._store.delete('user')
                this._application._store.delete('auth')

                this._application.log('authentication', __filename+'[startIpcEvents()] Received restart request. Restarting application...')
                this._application.restart()
                resolve(true)

            }).catch((error) => {
                this._application.log('authentication', __filename+'[startIpcEvents()] Error: Failed to clear local storage!')
                reject(error)
            })
        })
    }

    getFriends(){
        const worker = this._application._xboxWorker
        return Promise.resolve(worker ? Object.values(worker._friends) : [])
    }

    private async achievementUser() {
        if (!this._application._authentication._isAuthenticated || !this._application._webApi) throw new Error('Sign in to Xbox first')
        let xuid = String(this._application._store.get('user.xuid') || '')
        if (!/^\d{1,20}$/.test(xuid)) {
            const response = await this._application._webApi.providers.profile.getCurrentUser()
            xuid = String(response.data.profileUsers?.[0]?.id || '')
            if (!/^\d{1,20}$/.test(xuid)) throw new Error('Xbox profile unavailable')
            this._application._store.set('user.xuid', xuid)
        }
        return xuid
    }

    async getAchievementGames(args: { continuationToken?: string } = {}) {
        const xuid = await this.achievementUser()
        const token = typeof args.continuationToken === 'string' ? args.continuationToken : undefined
        const response = await this._application._webApi.providers.achievements.getAchievements(xuid, token, 50)
        return { items: response.data.titles || [], next: response.data.pagingInfo?.continuationToken || null }
    }

    async getGameAchievements(args: { titleId: string; continuationToken?: string }) {
        if (typeof args.titleId !== 'string' || !/^\d{1,10}$/.test(args.titleId)) throw new Error('Invalid Xbox title ID')
        const xuid = await this.achievementUser()
        const token = typeof args.continuationToken === 'string' ? args.continuationToken : undefined
        const response = await this._application._webApi.providers.achievements.getTitleId(xuid, args.titleId, token, 50)
        return { items: response.data.achievements || [], next: response.data.pagingInfo?.continuationToken || null }
    }

    getOnlineFriends(){
        return new Promise((resolve) => {
            if(this._application._xboxWorker === undefined){
                // Worker is not loaded yet..
                resolve([])
            } else {
                resolve(this._application._xboxWorker._onlineFriends)
            }
        })
    }

    onUiShown(){

        return new Promise((resolve) => {
            resolve({
                autoStream: this._application.getStartupFlags().autoStream,
            })
            this._application.getStartupFlags().autoStream = ''
        })
    }

    setForceRegionIp(args:setForceRegionIpArgs){
        return new Promise<boolean>((resolve) => {
            console.log('IPC received force region IP data and write to store:', args.ip)
            this._application._store.set('force_region_ip', args.ip)

            // Recreate Xal instance to reset all internal state and connections
            const { _authentication } = this._application
            const { _tokenStore } = _authentication
            const { Msal } = require('xal-node')
            _authentication._msal = new Msal(_tokenStore)

            // Rerun silent flow to retrieve new tokens with new region
            _authentication.startSilentFlow()

            resolve(true)
        })
    }

    setPreferredGameLanguage(args:setPreferredGameLanguageArgs){
        return new Promise((resolve) => {
            console.log('IPC received preferred game\'s language and write to store:', args.language)
            this._application._store.set('preferred_game_language', args.language)

            resolve(true)
        })
    }

    async debug(){
        const returnValue = []

        const gpuInfo = await electron.app.getGPUInfo('complete')

        // Application Values
        returnValue.push({
            name: 'Application',
            data: [
                { name: 'Name', value: 'Greenlight' },
                { name: 'Version', value: electron.app.getVersion() },
                { name: 'GPU Info', value: gpuInfo.auxAttributes.glRenderer },
            ],
        })

        // xCloud values
        returnValue.push({
            name: 'xCloud',
            data: [
                { name: 'Titles in cache', value: this._application._ipc._channels.xCloud._titles.length },
                { name: 'Titles last update', value: this._application._ipc._channels.xCloud._titlesLastUpdate },
                { name: 'Recent titles in cache', value: this._application._ipc._channels.xCloud._recentTitles.length },
                { name: 'Recent titles last update', value: this._application._ipc._channels.xCloud._recentTitlesLastUpdate },
                { name: '', value: ''},
                { name: 'Titlemanager titles loaded', value: Object.keys(this._application._ipc._channels.xCloud._titleManager._xCloudTitles).length },

            ],
        })

        // Streaming values
        returnValue.push({
            name: 'Streaming',
            data: [
                { name: 'Active sessions', value: Object.keys(this._application._ipc._channels.streaming._streamManager._sessions).length },

            ],
        })

        // Tokenstore values
        // returnValue.push({
        //     name: 'XAL',
        //     data: [
        //         { name: 'User token expires in', value: this._application._authentication._tokenStore.getUserToken().getSecondsValid() },
        //         { name: 'Authenticated user', value: this._application._authentication._tokenStore.getUserToken().getGamertag() + ' ('+this._application._authentication._tokenStore.getUserToken().getUserHash()+')' },
        //     ],
        // })

        return returnValue
    }
}
