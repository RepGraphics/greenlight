export type ControllerIdentity={index:number;id:string}
export function sameController(a:ControllerIdentity|undefined|null,b:ControllerIdentity|undefined|null){
    return Boolean(a&&b&&a.index===b.index&&a.id===b.id)
}

// A captured result remains confirmable only while its original controller
// still exists, is selected and the page has focus. Manual mappings need no pad.
export function controllerConfirmationValid(source:ControllerIdentity|null,selected:ControllerIdentity|undefined,pads:readonly ControllerIdentity[],focused:boolean){
    if(!source)return true
    return focused&&sameController(source,selected)&&pads.some(pad=>sameController(source,pad))
}
