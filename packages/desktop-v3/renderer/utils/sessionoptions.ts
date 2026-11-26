export type WebTouchMode='off'|'controller'|'direct'

// The shared player expects key -> Xbox button, not the reverse.
// Keep this reference stable across renders to avoid reattaching input drivers.
export const webKeyboardMapping:Record<string,string>=Object.freeze({
    Enter:'A',Backspace:'B',x:'X',y:'Y',
    ArrowUp:'DPadUp',ArrowDown:'DPadDown',ArrowLeft:'DPadLeft',ArrowRight:'DPadRight',
    '[':'LeftShoulder',']':'RightShoulder',l:'LeftThumb',r:'RightThumb',
    '-':'LeftTrigger','=':'RightTrigger',m:'Menu',v:'View',n:'Nexus',
})

// Console-paired controllers are a Remote Play feature. They must take
// precedence over all client-side input. Only one touch mode can be active.
export function webSessionInputOptions(type:'home'|'cloud',consolePaired:boolean,multipleControllers:boolean,touch:WebTouchMode,keyboard=false){
    const consoleController=type==='home'&&consolePaired
    return {
        consoleController,
        autoGamepad:!consoleController,
        multiController:!consoleController&&multipleControllers,
        touchControls:!consoleController&&touch==='controller',
        directTouch:!consoleController&&touch==='direct',
        keyboardMapping:!consoleController&&keyboard?webKeyboardMapping:undefined,
    }
}
