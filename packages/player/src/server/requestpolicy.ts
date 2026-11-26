type StreamType='home'|'cloud'
type Operation='state'|'sdp'|'ice'|'connect'|'keepalive'

// Only production Xbox streaming hosts, with an optional regional core label.
// These names are used in the existing gamepass controller and Xbox region metadata.
// Reject credentials, ports, URL paths, escapes and ambiguous URL normalization.
export function streamOrigin(value:unknown):string{
    if(typeof value!=='string'||value.length>253||!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\/?$/i.test(value))throw Error('Invalid Xbox streaming origin')
    const host=new URL(value).hostname
    if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.core)?\.gssv-play-prod(?:xhome|z)?\.xboxlive\.com$/.test(host))throw Error('Untrusted Xbox streaming origin')
    return 'https://'+host
}
export function playPath(type:StreamType){
    if(type!=='home'&&type!=='cloud')throw Error('Invalid Xbox stream type')
    return '/v5/sessions/'+type+'/play'
}
export function sessionEndpoint(type:StreamType,value:unknown,operation?:Operation){
    if(type!=='home'&&type!=='cloud')throw Error('Invalid Xbox stream type')
    if(typeof value!=='string'||value.length>256)throw Error('Invalid Xbox session path')
    const match=/^\/?v5\/sessions\/(home|cloud)\/([A-Za-z0-9][A-Za-z0-9_-]{0,159})$/.exec(value)
    if(!match||match[1]!==type||['play','active'].includes(match[2].toLowerCase()))throw Error('Invalid Xbox session path')
    if(operation&&!['state','sdp','ice','connect','keepalive'].includes(operation))throw Error('Invalid Xbox session operation')
    return '/v5/sessions/'+type+'/'+match[2]+(operation?'/'+operation:'')
}
