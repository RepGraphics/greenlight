import React from 'react'

const GameFavouritesContext = React.createContext<{ favourites: string[]; toggle: (id: string) => void }>({ favourites: [], toggle: () => {} })

export function GameFavouritesProvider({ account, children }: { account: string; children: React.ReactNode }) {
    const key = 'greenlight.games.' + account
    const [favourites, setFavourites] = React.useState<string[]>([])
    React.useEffect(() => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || '[]')
            setFavourites(Array.isArray(value) ? value.filter(id => typeof id === 'string') : [])
        } catch { setFavourites([]) }
    }, [key])
    const toggle = (id: string) => {
        const next = favourites.includes(id) ? favourites.filter(item => item !== id) : [...favourites, id]
        setFavourites(next)
        try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* unavailable storage */ }
    }
    return <GameFavouritesContext.Provider value={{ favourites, toggle }}>{children}</GameFavouritesContext.Provider>
}

export const useGameFavourites = () => React.useContext(GameFavouritesContext)
