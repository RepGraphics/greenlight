export interface ControllerSlot { slot:number; physicalId:number|null }
// Preserve assigned slots until a controller disconnects. Reserve slot zero
// for keyboard/touch emulation when there is no physical primary controller.
export function reconcileSlots(previous:ControllerSlot[], connected:number[], virtualPrimary=false):ControllerSlot[]{
    const available=[...new Set(connected.filter(id=>Number.isSafeInteger(id)&&id>=0))].sort((a,b)=>a-b)
    const result:ControllerSlot[]=[]
    for(const entry of previous){
        if(!Number.isInteger(entry.slot)||entry.slot<0||entry.slot>3||result.some(item=>item.slot===entry.slot))continue
        if(entry.physicalId!==null&&available.includes(entry.physicalId)&&!result.some(item=>item.physicalId===entry.physicalId))result.push({...entry})
    }
    for(const physicalId of available){
        if(result.some(item=>item.physicalId===physicalId))continue
        const slot=[0,1,2,3].find(index=>!result.some(item=>item.slot===index))
        if(slot===undefined)break
        result.push({slot,physicalId})
    }
    if(virtualPrimary&&!result.some(item=>item.slot===0))result.push({slot:0,physicalId:null})
    return result.sort((a,b)=>a.slot-b.slot)
}

// Keep a working primary controller; otherwise pick a free physical pad
// deterministically. Fixed multiplayer slots never steal another controller.
export function selectPhysicalGamepad(current:number,fixed:number,connected:number[],occupied:number[]):number{
    const free=[...new Set(connected.filter(id=>Number.isSafeInteger(id)&&id>=0&&!occupied.includes(id)))].sort((a,b)=>a-b)
    if(fixed>=0)return free.includes(fixed)?fixed:-1
    return free.includes(current)?current:free[0]??-1
}
