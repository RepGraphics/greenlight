import {createContext, useContext, useEffect, useState, type ReactNode} from 'react'
import {defaultStreamPreferences, normalizeStreamPreferences, preferencesKey, type StreamPreferences} from '../utils/streampreferences'

const Preferences = createContext<{
    preferences: StreamPreferences
    savePreferences: (value: StreamPreferences) => void
    storageAvailable: boolean
} | null>(null)

export function StreamPreferencesProvider({children}: {children: ReactNode}) {
    const [preferences, setPreferences] = useState(defaultStreamPreferences)
    const [storageAvailable, setStorageAvailable] = useState(true)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(preferencesKey)
            if (saved) setPreferences(normalizeStreamPreferences(JSON.parse(saved)))
        } catch {
            // The current session remains usable with the built-in defaults.
        }
    }, [])

    function savePreferences(value: StreamPreferences) {
        const next = normalizeStreamPreferences(value)
        setPreferences(next)
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
