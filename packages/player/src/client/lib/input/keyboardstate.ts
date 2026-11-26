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
    private held=new Map<string,{buttons:string[];sampled:boolean}>()
    private queuedTaps=new Set<string>()
    private releasePending=false
    get pending(){return this.held.size>0||this.queuedTaps.size>0||this.releasePending}
    press(event:KeyInput,mapping:Record<string,string>,editable=false){
        const id=identity(event)
        if(!id)return false
        if(this.held.has(id))return true
        if(editable||event.defaultPrevented||event.isComposing||event.repeat||event.altKey||event.ctrlKey||event.metaKey)return false
        const buttons=Object.entries(mapping).filter(([,key])=>key===event.key).map(([button])=>button)
        if(!buttons.length)return false
        this.held.set(id,{buttons,sampled:false})
        return true
    }
    release(event:KeyInput){
        const id=identity(event)
        const entry=this.held.get(id)
        if(!entry)return false
        this.held.delete(id)
        // A complete tap can arrive between two controller polling frames.
        // Preserve one pressed sample, followed by a release sample.
        if(!entry.sampled)for(const button of entry.buttons)this.queuedTaps.add(button)
        this.releasePending=true
        return true
    }
    read(){
        const buttons=new Set(this.queuedTaps)
        this.releasePending=this.queuedTaps.size>0
        this.queuedTaps.clear()
        for(const entry of this.held.values()){
            for(const button of entry.buttons)buttons.add(button)
            entry.sampled=true
        }
        return [...buttons]
    }
    clear(){this.held.clear();this.queuedTaps.clear();this.releasePending=false}
}
