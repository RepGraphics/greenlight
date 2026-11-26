// Console-paired controllers are a Remote Play feature. They must take
// precedence over all client-side gamepad registration and touch emulation.
export function webSessionInputOptions(type:'home'|'cloud',consolePaired:boolean,multipleControllers:boolean,touch:boolean){
    const consoleController=type==='home'&&consolePaired
    return {
        consoleController,
        autoGamepad:!consoleController,
        multiController:!consoleController&&multipleControllers,
        touchControls:!consoleController&&touch,
    }
}
