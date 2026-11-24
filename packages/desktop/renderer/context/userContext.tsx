import React, { useContext, useEffect, useState } from 'react'
import Ipc from '../lib/ipc'
import { portableSettings } from '../lib/settingsbackup'
import { defaultSettings } from './userContext.defaults'

export const SettingsContext = React.createContext({
    settings: defaultSettings,
    setSettings: (settings: typeof defaultSettings, persist = true) => settings,
})
export const useSettings = () => useContext(SettingsContext)

export const UserProvider = ({ children }) => {
    const [settings, setSettings] = useState(defaultSettings)
    function update(newSettings: typeof defaultSettings, persist = true) {
        const next = {...defaultSettings,...newSettings}
        setSettings(next)
        if (persist && typeof window !== 'undefined' && window.Greenlight?.isWebUI() !== true) {
            void Ipc.send('settings','setSettings',next).catch(() => {})
        }
        return next
    }
    useEffect(() => {
        let disposed = false
        async function load() {
            const stored = await Ipc.send('settings','getSettings')
            let next = {...defaultSettings,...stored}
            if (window.Greenlight?.isWebUI() !== true) {
                let legacy: string | null = null
                try { legacy = localStorage.getItem('settings') } catch {}
                if (legacy !== null) {
                    let migrated: ReturnType<typeof portableSettings> = {}
                    try { migrated = portableSettings(JSON.parse(legacy)) } catch {}
                    if (Object.keys(migrated).length) {
                        next = {...next,...migrated}
                        await Ipc.send('settings','setSettings',next)
                        try { localStorage.removeItem('settings') } catch {}
                    }
                }
            }
            if (!disposed) setSettings(next)
        }
        void load().catch(() => {})
        return () => { disposed = true }
    }, [])
    return <SettingsContext.Provider value={{settings,setSettings:update}}>{children}</SettingsContext.Provider>
}
