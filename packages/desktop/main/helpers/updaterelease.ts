import {compare} from 'compare-versions'
export const forkReleaseApi='https://api.github.com/repos/RepGraphics/greenlight/releases?per_page=50'
const forkReleasePage='https://github.com/RepGraphics/greenlight/releases/tag/'
interface ForkRelease {tag:string;version:string;url:string;notes:string;prerelease:boolean}
export interface UpdateResult {status:'none'|'current'|'available';installed:string;release?:ForkRelease}
function version(value:unknown){
    if(typeof value!=='string'||value.length>100||!/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value))return null
    return value.replace(/^v/,'')
}
export function selectForkRelease(value:unknown,installed:string,includePrereleases=false):UpdateResult{
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
        candidates.push({tag,version:normalized,url:forkReleasePage+encodeURIComponent(tag),notes:typeof item.body==='string'?item.body.slice(0,16000):'',prerelease})
    }
    candidates.sort((a,b)=>compare(a.version,b.version,'>')?-1:compare(a.version,b.version,'<')?1:0)
    const release=candidates[0]
    if(!release)return {status:'none',installed}
    return {status:compare(release.version,current,'>')?'available':'current',installed,release}
}
