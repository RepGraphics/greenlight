import { installClassicInputLifecycle } from './classicinputlifecycle'
import {defaultButtonMapping,validateButtonMapping} from '../../../player/src/client/lib/input/mapping'
import {readProfiles,snapshotProfile} from './controllerprofiles'
import type {ControllerProfile} from './controllerprofiles'

type InputSettings=Partial<ControllerProfile>&{v3_controller_profiles?:unknown}
type ClassicDriver<T>={mapStateLabels:(buttons:ReadonlyArray<GamepadButton>,axes:ReadonlyArray<number>)=>T}
export function resolveClassicControllerProfile(settings:InputSettings,name?:string){
    return (name&&readProfiles(settings.v3_controller_profiles).find(profile=>profile.name===name))||snapshotProfile('',settings)
}
const value=(input:unknown,min:number,max:number)=>typeof input==='number'&&Number.isFinite(input)?Math.max(min,Math.min(max,input)):0
function axis(input:unknown,deadzone:number){
    const n=value(input,-1,1)
    return Math.abs(n)<=deadzone?0:Math.sign(n)*(Math.abs(n)-deadzone)/(1-deadzone)
}
export function mapClassicPhysicalInput(buttons:ReadonlyArray<GamepadButton>,axes:ReadonlyArray<number>,settings:Partial<ControllerProfile>){
    const profile=snapshotProfile('',settings)
    const mapping=validateButtonMapping(profile.v3_button_mapping)
    const mapped:GamepadButton[]=Array.from({length:17},()=>({value:0,pressed:false,touched:false}))
    for(const [key,index] of Object.entries(defaultButtonMapping)){
        const button=buttons[Number(mapping[key])]
        mapped[Number(index)]={value:value(button?.value,0,1),pressed:Boolean(button?.pressed),touched:Boolean(button?.touched)}
    }
    const order=profile.v3_swap_sticks?[2,3,0,1]:[0,1,2,3]
    const mappedAxes=order.map((source,index)=>{
        const n=axis(axes[source],profile.v3_deadzone)
        return n===0?0:profile.v3_invert_y&&index%2===1?-n:n
    })
    return {buttons:mapped,axes:mappedAxes}
}
// xbox-xcloud-player 0.2.11 funnels physical state through mapStateLabels in
// both input modes. Preserve its shadow buttons, keyboard merge and packet
// logic by adapting only the physical arguments before calling the original.
export function configureClassicControllerProfile<T>(driver:ClassicDriver<T>|undefined,settings:Partial<ControllerProfile>){
    if(!driver||typeof driver.mapStateLabels!=='function')return false
    const original=driver.mapStateLabels
    const profile=snapshotProfile('',settings)
    driver.mapStateLabels=function(buttons,axes){
        const mapped=mapClassicPhysicalInput(buttons,axes,profile)
        return original.call(this,mapped.buttons,mapped.axes)
    }
    installClassicInputLifecycle(driver)
    return true
}
