import {compare} from 'compare-versions'
export const forkReleaseApi='https://api.github.com/repos/RepGraphics/greenlight/releases?per_page=50'
const forkReleasePage='https://github.com/RepGraphics/greenlight/releases/tag/'
export interface ForkInstaller {name:string;size:number;sha256:string;url:string}
interface ForkRelease {tag:string;version:string;url:string;notes:string;prerelease:boolean;installer?:ForkInstaller}
export interface UpdateResult {status:'none'|'current'|'available';installed:string;release?:ForkRelease}
function version(value:unknown){
    if(typeof value!=='string'||value.length>100||!/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value))return null
    return value.replace(/^v/,'')
}
export const maximumInstallerBytes=1024*1024*1024

// CI publishes platform-prefixed installers. Do not guess between multiple
// candidates, or install a package for an architecture we do not build.
export function selectForkInstaller(assets:unknown,tag:string,platform:string,arch:string):ForkInstaller|undefined{
    if(!version(tag))return
    const pattern=platform==='win32'&&arch==='x64'?/^windows-[A-Za-z0-9][A-Za-z0-9 ._+-]*\.exe$/i:
        platform==='linux'&&arch==='x64'?/^linux-[A-Za-z0-9][A-Za-z0-9 ._+-]*\.AppImage$/i:
        platform==='darwin'&&['x64','arm64'].includes(arch)?/^macos-[A-Za-z0-9][A-Za-z0-9 ._+-]*\.dmg$/i:null
    if(!pattern)return
    const matches:ForkInstaller[]=[]
    for(const item of Array.isArray(assets)?assets:[]){
        if(!item||typeof item!=='object'||item.state!=='uploaded'||typeof item.name!=='string'||item.name.length>180||!pattern.test(item.name))continue
        if(/(?:^|[ ._-])(?:arm64|aarch64|ia32|i686|x86)(?:[ ._-]|$)/i.test(item.name)&&platform!=='darwin')continue
        if(platform==='darwin'&&/(?:^|[ ._-])(?:arm64|aarch64|x64|x86_64)(?:[ ._-]|$)/i.test(item.name))continue
        if(!Number.isSafeInteger(item.size)||item.size<=0||item.size>maximumInstallerBytes||typeof item.digest!=='string'||!/^sha256:[a-f0-9]{64}$/i.test(item.digest))continue
        matches.push({name:item.name,size:item.size,sha256:item.digest.slice(7).toLowerCase(),url:'https://github.com/RepGraphics/greenlight/releases/download/'+encodeURIComponent(tag)+'/'+encodeURIComponent(item.name)})
    }
    return matches.length===1?matches[0]:undefined
}
export function selectForkRelease(value:unknown,installed:string,includePrereleases=false,platform='',arch=''):UpdateResult{
    const current=version(installed)
    if(!current)throw Error('Invalid installed version')
    const candidates:ForkRelease[]=[]
    for(const item of Array.isArray(value)?value:[]){
        if(!item||typeof item!=='object'||item.draft!==false)continue
        const tag=item.tag_name
        const normalized=version(tag)
        if(!normalized)continue
        const prerelease=item.prerelease===true||normalized.split('+')[0].includes('-')
        if(prerelease&&!includePrereleases)continue
        candidates.push({tag,version:normalized,url:forkReleasePage+encodeURIComponent(tag),notes:typeof item.body==='string'?item.body.slice(0,16000):'',prerelease,installer:selectForkInstaller(item.assets,tag,platform,arch)})
    }
    candidates.sort((a,b)=>compare(a.version,b.version,'>')?-1:compare(a.version,b.version,'<')?1:0)
    const release=candidates[0]
    if(!release)return {status:'none',installed}
    return {status:compare(release.version,current,'>')?'available':'current',installed,release}
}
