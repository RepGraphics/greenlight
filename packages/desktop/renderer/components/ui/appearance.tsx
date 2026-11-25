import React from 'react'
import {useSettings} from '../../context/userContext'
import {normalizeAppearance} from '../../lib/appearance'

export default function Appearance(){
    const {settings}=useSettings()
    const {theme,accent}=normalizeAppearance(settings.appearance_theme,settings.appearance_accent)
    React.useEffect(()=>{
        const root=document.documentElement
        root.dataset.glTheme=theme
        root.dataset.glAccent=accent
        return()=>{delete root.dataset.glTheme;delete root.dataset.glAccent}
    },[theme,accent])
    return null
}
