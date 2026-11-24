import Ipc from '../lib/ipc'
import { useQuery } from 'react-query'
export interface XboxFriend {
    xuid: string;
    displayName?: string;
    gamertag?: string;
    displayPicRaw?: string;
    presenceState?: string;
    presenceText?: string;
    gamerscore?: string | number;
    presenceDetails?: { IsGame?: boolean; IsPrimary?: boolean; PresenceText?: string }[];
}
export function friendPresence(friend: XboxFriend) {
    return friend.presenceDetails?.find?.(app => app.IsGame && app.IsPrimary)?.PresenceText || friend.presenceText || friend.presenceState || ''
}
export function useFriends() {
    return useQuery<XboxFriend[]>('social-friends', async () => {
        const result = await Ipc.send('app', 'getFriends')
        return Array.isArray(result) ? result.filter(friend => friend && typeof friend.xuid === 'string') : []
    }, { staleTime: 15000, refetchInterval: 15000 })
}
