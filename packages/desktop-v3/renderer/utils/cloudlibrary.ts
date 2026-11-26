export interface CloudTitle {
    id:string
    productId:string
    name:string
    publisher:string
    entitled:boolean
}
const textValue=(value:unknown,max:number)=>typeof value==='string'?value.trim().slice(0,max):''
export function normalizeCloudTitles(response:unknown):CloudTitle[]{
    const envelope=response as {data?:{results?:unknown}}|null
    if(!Array.isArray(envelope?.data?.results))throw Error('Cloud catalog unavailable')
    const seen=new Set<string>()
    const titles:CloudTitle[]=[]
    for(const item of envelope.data.results){
        if(!item||typeof item!=='object'||typeof item.titleId!=='string'||!item.titleId.trim()||item.titleId.length>160||seen.has(item.titleId))continue
        seen.add(item.titleId)
        titles.push({
            id:item.titleId,productId:textValue(item.details?.productId,128),
            name:textValue(item.details?.title,160)||textValue(item.title,160)||item.titleId,
            publisher:'',entitled:item.details?.hasEntitlement===true||item.details?.isFreeInStore===true,
        })
    }
    return titles
}
export function catalogBatches(titles:CloudTitle[]){
    const ids=[...new Set(titles.map(title=>title.productId).filter(Boolean))]
    const batches:string[][]=[]
    for(let offset=0;offset<ids.length;offset+=100)batches.push(ids.slice(offset,offset+100))
    return batches
}
export function hydrateCloudTitles(titles:CloudTitle[],response:unknown):CloudTitle[]{
    const products=(response as {data?:{Products?:unknown}}|null)?.data?.Products
    if(!products||typeof products!=='object'||Array.isArray(products))throw Error('Cloud metadata unavailable')
    const byProduct=new Map<string,{name:string;publisher:string}>()
    for(const [key,value] of Object.entries(products)){
        if(!value||typeof value!=='object')continue
        const item=value as Record<string,unknown>
        const productId=textValue(item.StoreId,128)||key
        const name=textValue(item.ProductTitle,160),publisher=textValue(item.PublisherName,128)
        if(name)byProduct.set(productId,{name,publisher})
    }
    return titles.map(title=>{const metadata=byProduct.get(title.productId);return metadata?{...title,...metadata}:title})
}
export function filterCloudTitles(titles:CloudTitle[],search:string,entitledOnly:boolean,sort:'az'|'za'){
    const query=search.trim().toLocaleLowerCase()
    return titles.filter(title=>(!entitledOnly||title.entitled)&&[title.name,title.publisher].some(value=>value.toLocaleLowerCase().includes(query)))
        .sort((a,b)=>(sort==='za'?-1:1)*a.name.localeCompare(b.name)||a.id.localeCompare(b.id))
}
