const allowed: Record<string, string[]> = {
    app: ['loadCachedUser', 'getAuthState', 'login', 'quit', 'restart', 'clearData', 'getOnlineFriends', 'getFriends', 'getAchievementGames', 'getGameAchievements', 'onUiShown', 'setForceRegionIp', 'setPreferredGameLanguage', 'debug', 'getCaptureDirectory', 'chooseCaptureDirectory', 'clearCaptureDirectory', 'exportCapture'],
    settings: ['setSettings', 'getSettings', 'getWebUIStatus', 'getWebUIAccessToken', 'startWebUI', 'stopWebUI', 'setLowResolution'],
    consoles: ['get','power'],
    xCloud: ['getRecentTitles', 'getTitles', 'filterTitles', 'getNewTitles', 'getTitle'],
    streaming: ['startStream', 'stopStream', 'sendSdp', 'sendChatSdp', 'sendIce', 'sendKeepalive', 'getPlayerState', 'activeSessions', 'setStreamAwake'],
}

export function isAllowedIpc(channel:unknown,action:unknown):boolean {
    return typeof channel==='string'&&typeof action==='string'&&Object.prototype.hasOwnProperty.call(allowed,channel)&&allowed[channel].includes(action)
}
export function isAllowedWebIpc(channel:unknown,action:unknown):boolean{
    if(!isAllowedIpc(channel,action))return false
    if(channel==='streaming'&&action==='setStreamAwake')return false
    if(channel==='consoles'&&action==='power')return false
    if(channel==='app'&&['quit','restart','clearData','login','setForceRegionIp','setPreferredGameLanguage','debug','getCaptureDirectory','chooseCaptureDirectory','clearCaptureDirectory','exportCapture'].includes(action as string))return false
    if(channel==='settings'&&action!=='getSettings'&&action!=='getWebUIStatus')return false
    return true
}
