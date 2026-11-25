// Track the physical key code, rather than its modifier-sensitive label.
// Keep keyboard ownership separate from touch/physical button overrides.
type KeyInput={key:string;code?:string;repeat?:boolean;altKey?:boolean;ctrlKey?:boolean;metaKey?:boolean;shiftKey?:boolean;defaultPrevented?:boolean;isComposing?:boolean}
const identity=(event:KeyInput)=>event.code&&event.code!=='Unidentified'?event.code:event.key
export function isEditableGamepadTarget(target:EventTarget|null){
    if(!target||typeof (target as Element).closest!=='function')return false
    const element=target as HTMLElement
    return Boolean(element.isContentEditable||element.closest('input, textarea, select, button, [contenteditable]:not([contenteditable="false"]), [role="textbox"]'))
}
export class KeyboardGamepadState{
    private held=new Map<string,string[]>()
    private releasePending=false
    get pending(){return this.held.size>0||this.releasePending}
    press(event:KeyInput,mapping:Record<string,string>,editable=false){
        const id=identity(event)
        if(!id)return false
        if(this.held.has(id))return true
        if(editable||event.defaultPrevented||event.isComposing||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return false
        const buttons=Object.entries(mapping).filter(([,key])=>key===event.key).map(([button])=>button)
        if(!buttons.length)return false
        this.held.set(id,buttons)
        return true
    }
    release(event:KeyInput){
        if(!this.held.delete(identity(event)))return false
        this.releasePending=true
        return true
    }
    read(){
        this.releasePending=false
        return [...new Set([...this.held.values()].flat())]
    }
    clear(){this.held.clear();this.releasePending=false}
}
