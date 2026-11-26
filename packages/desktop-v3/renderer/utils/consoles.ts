export interface ConsoleSummary {
    id:string
    name:string
    powerState:string
    remoteManagementEnabled:boolean
    consoleStreamingEnabled:boolean
}
export function normalizeConsoles(response:unknown):ConsoleSummary[]{
    const envelope=response as {data?:{result?:unknown}}|null
    if(!Array.isArray(envelope?.data?.result))throw Error('Console list unavailable')
    const consoles:ConsoleSummary[]=[]
    const ids=new Set<string>()
    for(const item of envelope.data.result){
        if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id.trim()||item.id.length>128||ids.has(item.id))continue
        ids.add(item.id)
        consoles.push({
            id:item.id,
            name:typeof item.name==='string'&&item.name.trim()?item.name.slice(0,128):'Xbox console',
            powerState:typeof item.powerState==='string'&&item.powerState.trim()?item.powerState.slice(0,64):'Unknown',
            remoteManagementEnabled:item.remoteManagementEnabled===true,
            consoleStreamingEnabled:item.consoleStreamingEnabled===true,
        })
    }
    return consoles
}
export function consoleReady(item:ConsoleSummary){
    return item.remoteManagementEnabled&&item.consoleStreamingEnabled
}
export function searchConsoles(items:ConsoleSummary[],query:string){
    const search=query.trim().toLowerCase()
    return items.filter(item=>item.name.toLowerCase().includes(search))
        .sort((a,b)=>Number(consoleReady(b))-Number(consoleReady(a))||a.name.localeCompare(b.name))
}
