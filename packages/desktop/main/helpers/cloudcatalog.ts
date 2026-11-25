interface CloudTitle {
    titleId?:unknown
    hasEntitlement?:unknown
    catalogDetails?:{ProductTitle?:unknown;PublisherName?:unknown}
}
const normalize=(value:unknown)=>typeof value==='string'?value.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().trim():''
export function filterCloudCatalog(entries:unknown[],filter:unknown):string[]{
    const options=filter&&typeof filter==='object'?filter as {name?:unknown;onlyEntitled?:unknown;sort?:unknown}:{}
    const query=normalize(typeof options.name==='string'?options.name.slice(0,100):'').split(/\s+/).filter(Boolean)
    const seen=new Set<string>()
    const result:Array<{id:string;name:string}>=[]
    for(const value of entries){
        if(!value||typeof value!=='object')continue
        const item=value as CloudTitle
        if(typeof item.titleId!=='string'||!item.titleId||seen.has(item.titleId)||(options.onlyEntitled!==false&&item.hasEntitlement!==true))continue
        const name=normalize(item.catalogDetails?.ProductTitle)
        const text=name+' '+normalize(item.catalogDetails?.PublisherName)
        if(!query.every(term=>text.includes(term)))continue
        seen.add(item.titleId);result.push({id:item.titleId,name})
    }
    if(options.sort==='az'||options.sort==='za'){
        const direction=options.sort==='az'?1:-1
        result.sort((a,b)=>!a.name&&!b.name?0:!a.name?1:!b.name?-1:a.name.localeCompare(b.name,undefined,{numeric:true})*direction)
    }
    return result.map(item=>item.id)
}
