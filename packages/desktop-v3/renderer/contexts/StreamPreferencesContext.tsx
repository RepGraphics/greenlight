import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react'
import {defaultStreamPreferences, normalizeStreamPreferences, preferencesKey, type StreamPreferences} from '../../shared/streampreferences'

const Preferences = createContext<{
    preferences: StreamPreferences
    savePreferences: (value: StreamPreferences) => void
    storageAvailable: boolean
} | null>(null)

export function StreamPreferencesProvider({children}: {children: ReactNode}) {
    const [preferences, setPreferences] = useState(defaultStreamPreferences)
    const [storageAvailable, setStorageAvailable] = useState(true)
    const version = useRef(0)

    useEffect(() => {
        let current = true
        const initialVersion = version.current
        async function load() {
            const desktop = window.greenlightDesktop?.preferences
            try {
                const native = desktop ? await desktop.load() : null
                if (!current || initialVersion !== version.current) return
                if (native) {setPreferences(normalizeStreamPreferences(native));return}
                const legacy = localStorage.getItem(preferencesKey)
                if (legacy) {
                    const migrated = normalizeStreamPreferences(JSON.parse(legacy))
                    setPreferences(migrated)
                    if (desktop) await desktop.save(migrated)
                }
            } catch {
                if (current && initialVersion === version.current) setStorageAvailable(false)
            }
        }
        void load()
        return () => {current = false}
    }, [])

    function savePreferences(value: StreamPreferences) {
        const next = normalizeStreamPreferences(value)
        const revision = ++version.current
        setPreferences(next)
        const desktop = window.greenlightDesktop?.preferences
        if (desktop) {
            void desktop.save(next).then(
                () => {if (version.current === revision) setStorageAvailable(true)},
                () => {if (version.current === revision) setStorageAvailable(false)},
            )
            return
        }
        try {
            localStorage.setItem(preferencesKey, JSON.stringify(next))
            setStorageAvailable(true)
        } catch {
            setStorageAvailable(false)
        }
    }

    return <Preferences.Provider value={{preferences, savePreferences, storageAvailable}}>{children}</Preferences.Provider>
}

export function useStreamPreferences() {
    const context = useContext(Preferences)
    if (!context) throw Error('Missing streaming preferences provider')
    return context
}
