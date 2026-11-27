import {Gamepad2} from 'lucide-react'

export default function GameArt({src, lazy = true}: {src?: string; lazy?: boolean}) {
    return <span className="v3-game-art" aria-hidden="true">
        <Gamepad2 size={44} strokeWidth={1.25}/>
        {src && <img key={src} src={src} alt="" loading={lazy ? 'lazy' : 'eager'} referrerPolicy="no-referrer" onError={event => {event.currentTarget.hidden = true}}/>}
    </span>
}
