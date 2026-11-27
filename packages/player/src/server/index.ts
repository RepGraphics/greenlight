import type { xStreamToken, xCloudStreamConfig, SDPResponse, startStreamResponse, StatusResponse, ErrorResponse } from '../types/index';
export type { xStreamToken, startStreamResponse, SDPResponse, xCloudStreamConfig, StatusResponse, ErrorResponse };
import {streamOrigin,playPath,sessionEndpoint} from './requestpolicy';
import {readStreamingResponse,streamingResponseLimit,transferTokenResponseLimit} from './response';
import {xboxIceAnswer,validateXboxIceCandidates} from './iceexchange'

export const ping = () => 'pong';

export const startStream = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig) => {
    return await httpPost<startStreamResponse>(xStreamToken, xCloudStreamConfig, playPath(xCloudStreamConfig.type), JSON.stringify({
        clientSessionId: '',
        titleId: (xCloudStreamConfig.type === 'cloud') ? xCloudStreamConfig.id : '',
        systemUpdateGroup: '',
        settings: {
            nanoVersion: 'V3;WebrtcTransport.dll',
            enableOptionalDataCollection: false,
            enableTextToSpeech: false,
            highContrast: 0,
            locale: xCloudStreamConfig.language,
            useIceConnection: false,
            timezoneOffsetMinutes: 120,
            sdkType: 'web',
            osName: 'windows',
        },
        serverId: (xCloudStreamConfig.type === 'home') ? xCloudStreamConfig.id : '',
        fallbackRegionNames: [],
    }))
}

export const getStreamStatus = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string) => {
    return await httpGet<startStreamResponse>(xStreamToken, xCloudStreamConfig, sessionEndpoint(xCloudStreamConfig.type,sessionPath,'state'))
}

export const sendSDPOffer = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string, sdpOffer:RTCSessionDescriptionInit) => {
    await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, sessionEndpoint(xCloudStreamConfig.type,sessionPath,'sdp'), JSON.stringify({
        'messageType':'offer',
        'sdp': sdpOffer.sdp,
        'requestId': '1',
        'configuration':{
            'chatConfiguration':{
                'bytesPerSample':2,
                'expectedClipDurationMs':20,
                'format':{
                    'codec':'opus',
                    'container':'webm',
                },
                'numChannels':1,
                'sampleFrequencyHz':24000,
            },
            'chat':{
                'minVersion':1,
                'maxVersion':1,
            },
            'control':{
                'minVersion':1,
                'maxVersion':3,
            },
            'input':{
                'minVersion':1,
                'maxVersion':9,
            },
            'message':{
                'minVersion':1,
                'maxVersion':1,
            },
            'reliableinput':{
                'minVersion':9,
                'maxVersion':9,
            },
            'unreliableinput':{
                'minVersion':9,
                'maxVersion':9,
            },
        },
    }))

    return await pollExchange<SDPResponse>(xStreamToken, xCloudStreamConfig, sessionEndpoint(xCloudStreamConfig.type,sessionPath,'sdp'))
}

// Match the desktop chat renegotiation configuration rather than creating a
// second stream or using the initial SDP negotiation configuration.
export const sendChatSDP = async (token:xStreamToken,config:xCloudStreamConfig,sessionPath:string,offer:RTCSessionDescriptionInit):Promise<string>=>{
    const path=sessionEndpoint(config.type,sessionPath,'sdp')
    if(offer?.type!=='offer'||typeof offer.sdp!=='string'||!offer.sdp.trim()||offer.sdp.length>262144)throw Error('Invalid chat SDP offer')
    await httpPost<StatusResponse>(token,config,path,JSON.stringify({
        messageType:'offer',
        sdp:offer.sdp,
        configuration:{isMediaStreamsChatRenegotiation:true},
    }))
    const response=await pollExchange<SDPResponse>(token,config,path) as {exchangeResponse?:unknown}|null
    if(typeof response?.exchangeResponse!=='string')throw Error('Invalid chat SDP response')
    try{
        const answer=JSON.parse(response.exchangeResponse)
        if(typeof answer?.sdp!=='string'||!answer.sdp.trim()||answer.sdp.length>262144||(answer.type!==undefined&&answer.type!=='answer'))throw Error('Invalid chat SDP answer')
        return answer.sdp
    }catch{throw Error('Invalid chat SDP answer')}
}

export const sendICECandidates = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string, candidates:unknown[]) => {
    const path = sessionEndpoint(xCloudStreamConfig.type,sessionPath,'ice')
    await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, path, JSON.stringify({
        messageType: 'iceCandidate',
        candidate: validateXboxIceCandidates(candidates),
    }))
    const response = await pollExchange<SDPResponse>(xStreamToken, xCloudStreamConfig, path)
    const exchange = (response as SDPResponse)?.exchangeResponse
    return {exchangeResponse: JSON.stringify(xboxIceAnswer(exchange, xCloudStreamConfig.type === 'home'))}
}

export const sendMsalToken = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string, userRefreshToken:string) => {
    // Validate the session and destination before exchanging a refresh token.
    streamOrigin(xCloudStreamConfig.host)
    sessionEndpoint(xCloudStreamConfig.type,sessionPath,'connect')
    // Fetch token server sided
    const tokenData = await fetch('https://login.live.com/oauth20_token.srf', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: '1f907974-e22b-4810-a9de-d9647380c97e',
        scope: 'service::http://Passport.NET/purpose::PURPOSE_XBOX_CLOUD_CONSOLE_TRANSFER_TOKEN',
        grant_type: 'refresh_token',
        refresh_token: userRefreshToken,
      }),
    })
    if (!tokenData.ok) {
        await tokenData.body?.cancel().catch(()=>{});
        throw new Error('Unable to retrieve console transfer token');
    }
    const token = await readStreamingResponse(tokenData,transferTokenResponseLimit) as {access_token?:unknown}|null;
    if (typeof token?.access_token !== 'string' || !token.access_token.trim()) throw new Error('Invalid console transfer token');

    return await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, sessionEndpoint(xCloudStreamConfig.type,sessionPath,'connect'), JSON.stringify({
        userToken: token.access_token
    }))
}

export const sendKeepalive = async (xStreamToken:xStreamToken, xCloudStreamConfig:xCloudStreamConfig, sessionPath:string) => {
    return await httpPost<StatusResponse>(xStreamToken, xCloudStreamConfig, sessionEndpoint(xCloudStreamConfig.type,sessionPath,'keepalive'), JSON.stringify({}))
}

// A missing/expired session is already terminated. All other failures
// remain failures; callers must retain ownership and explicitly retry.
export const stopStream=async (token:xStreamToken,config:xCloudStreamConfig,sessionPath:string):Promise<StatusResponse>=>{
    const path=sessionEndpoint(config.type,sessionPath)
    const response=await fetch(streamOrigin(config.host)+path,{
        method:'DELETE',redirect:'error',signal:AbortSignal.timeout(15000),
        headers:requestHeaders(token,config),
    })
    await response.body?.cancel()
    if(response.ok||response.status===404||response.status===410)return {status:response.status}
    throw {error:{status:response.status}}
}

async function pollExchange<T>(token: xStreamToken, config: xCloudStreamConfig, url: string) {
    const deadline = Date.now() + 45000
    do {
        const response = await httpGet<T>(token, config, url)
        const envelope = response as SDPResponse
        if (envelope?.errorDetails?.code != null && envelope.errorDetails.code !== 0) {
            throw Error('Xbox rejected the signaling exchange')
        }
        const waiting = [200,202,204].includes((response as StatusResponse)?.status) && envelope?.exchangeResponse === undefined
        if (!waiting && envelope?.exchangeResponse !== null) return response
        await new Promise(resolve => setTimeout(resolve, 750))
    } while (Date.now() < deadline)
    throw new Error('Streaming handshake timed out')
}

const requestHeaders=(token:xStreamToken,config:xCloudStreamConfig)=>({
    'Accept':'application/json',
    'Content-Type':'application/json',
    'X-Gssv-Client':'XboxComBrowser',
    'X-MS-Device-Info':getDeviceInfo(config),
    ...(token.token!==''?{'Authorization':'Bearer '+token.token}:{}),
})

async function httpRequest<T>(token:xStreamToken,config:xCloudStreamConfig,path:string,method:'GET'|'POST',body?:string,headers={}):Promise<T|StatusResponse|ErrorResponse>{
    const response=await fetch(streamOrigin(config.host)+path,{
        method,redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{...requestHeaders(token,config),...headers},
        ...(body===undefined?{}:{body}),
    })
    if(!response.ok){
        await response.body?.cancel().catch(()=>{})
        // Never serialize response bodies, Request objects or credentials in RPC errors.
        throw {error:{status:response.status}} as ErrorResponse
    }
    const value=await readStreamingResponse(response,streamingResponseLimit)
    if(value===undefined)return {status:response.status}
    return value as T
}
const httpGet=<T>(token:xStreamToken,config:xCloudStreamConfig,path:string,headers={})=>httpRequest<T>(token,config,path,'GET',undefined,headers)
const httpPost=<T>(token:xStreamToken,config:xCloudStreamConfig,path:string,body:string,headers={})=>httpRequest<T>(token,config,path,'POST',body,headers)

const getDeviceInfo = (xCloudStreamConfig:xCloudStreamConfig) => {
    return JSON.stringify({
        'appInfo': {
            'env': {
                'clientAppId':'www.xbox.com',
                'clientAppType':'browser',
                'clientAppVersion':'21.1.98',
                'clientSdkVersion':'8.5.3',
                'httpEnvironment':'prod',
                'sdkInstallId':'',
            },
        },
        'dev': {
            'hw': {
                'make': 'Microsoft',
                'model': 'unknown',
                'sdktype': 'web',
            },
            'os': {
                'name': (xCloudStreamConfig.resolution === 1080) ? 'windows' : 'android',
                'ver': '22631.2715',
                'platform': 'desktop',
            },
            'displayInfo': {
                'dimensions': {
                    'widthInPixels': 1920,
                    'heightInPixels': 1080,
                },
                'pixelDensity': {
                    'dpiX': 2,
                    'dpiY': 2,
                },
            },
            'browser':{
                'browserName':'chrome',
                'browserVersion':'119.0',
            },
        },
    })
}
