export const shortcutDefaults = { controls:'F8', fullscreen:'', mute:'', hud:'', screenshot:'', recording:'', graphs:'', replay:'' }
export type StreamAction = keyof typeof shortcutDefaults
export const shortcutKeys = ['', 'F6','F7','F8','F9','F10']
export function validateShortcuts(value:unknown):typeof shortcutDefaults {
    const raw=value && typeof value==='object' ? value as Record<string,unknown> : {}
    const result={...shortcutDefaults}
    const used=new Set<string>()
    for(const action of Object.keys(result) as StreamAction[]){
        const candidate=raw[action]
        const key=typeof candidate==='string'&&shortcutKeys.includes(candidate)?candidate:shortcutDefaults[action]
        result[action]=key&&!used.has(key)?key:''
        if(result[action])used.add(result[action])
    }
    return result
}
export function assignShortcut(value:unknown,action:StreamAction,key:string){
    const next=validateShortcuts(value)
    if(!shortcutKeys.includes(key))return next
    for(const other of Object.keys(next) as StreamAction[])if(other!==action&&key&&next[other]===key)next[other]=''
    next[action]=key
    return next
}
export function shortcutAction(value:unknown,event:{key:string;repeat:boolean;altKey:boolean;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean;editable:boolean}):StreamAction|undefined{
    if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.editable)return
    const shortcuts=validateShortcuts(value)
    return (Object.keys(shortcuts) as StreamAction[]).find(action=>Boolean(shortcuts[action])&&shortcuts[action]===event.key)
}

export function classicShortcutAction(value:unknown,event:Parameters<typeof shortcutAction>[1],pointerLocked:boolean,mapping:unknown,defaultPrevented=false){
    if(defaultPrevented||pointerLocked||mapping&&typeof mapping==='object'&&Object.prototype.hasOwnProperty.call(mapping,event.key))return undefined
    return shortcutAction(value,event)
}
