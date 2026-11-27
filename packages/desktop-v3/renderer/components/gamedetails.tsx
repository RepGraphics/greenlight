import {useEffect, useRef} from 'react'
import {Play, Star, X} from 'lucide-react'
import GameArt from './gameart'
import type {CloudTitle} from '../utils/cloudlibrary'

export default function GameDetails({title, favorite, onFavorite, onPlay, onClose}: {
    title: CloudTitle
    favorite: boolean
    onFavorite: () => void
    onPlay: () => void
    onClose: () => void
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        const element = dialog.current
        if (!element) return
        element.showModal()
        return () => {if (element.open) element.close()}
    }, [])

    return <dialog ref={dialog} className="v3-game-dialog" onClose={() => {if (!dialog.current?.open) onClose()}} aria-labelledby="v3-game-title">
        <div className="v3-game-dialog-visual">
            <GameArt src={title.hero ?? title.cover} lazy={false}/>
            <button type="button" className="v3-button v3-button-secondary v3-icon-button" aria-label="Close game details" onClick={() => dialog.current?.close()}><X size={21} aria-hidden="true"/></button>
        </div>
        <div className="v3-game-dialog-body">
            <h2 id="v3-game-title">{title.name}</h2>
            {title.publisher && <p className="v3-muted">{title.publisher}</p>}
            {title.description && <p className="v3-description">{title.description}</p>}
            {!title.entitled && <p className="v3-notice">Cloud access is unavailable for this title on your account.</p>}
            <div className="v3-actions">
                <button type="button" className="v3-button v3-button-primary" disabled={!title.entitled} onClick={onPlay}><Play size={17} aria-hidden="true"/> Play</button>
                <button type="button" className="v3-button v3-button-secondary" aria-pressed={favorite} onClick={onFavorite}><Star size={17} fill={favorite ? 'currentColor' : 'none'} aria-hidden="true"/> Favourite</button>
            </div>
        </div>
    </dialog>
}
