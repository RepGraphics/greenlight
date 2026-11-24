import { useInfiniteQuery } from 'react-query'
import Ipc from '../lib/ipc'
export interface AchievementGame { titleId: number | string; name: string; earnedAchievements?: number; currentGamerscore?: number; maxGamerscore?: number }
export interface Achievement { id: string; serviceConfigId?: string; name: string; progressState?: string; isSecret?: boolean; description?: string; lockedDescription?: string; rewards?: { type: string; value: string }[]; progression?: { timeUnlocked?: string }; titleAssociations?: { name: string }[] }
interface Page<T> { items: T[]; next: string | null }
export function useAchievementGames() {
    return useInfiniteQuery<Page<AchievementGame>>('achievement-games', ({ pageParam }) => Ipc.send('app', 'getAchievementGames', { continuationToken: pageParam }) as Promise<Page<AchievementGame>>, { getNextPageParam: last => last.next || undefined, staleTime: 60000 })
}
export function useGameAchievements(titleId: string) {
    return useInfiniteQuery<Page<Achievement>>(['achievement-title', titleId], ({ pageParam }) => Ipc.send('app', 'getGameAchievements', { titleId, continuationToken: pageParam }) as Promise<Page<Achievement>>, { enabled: /^\d{1,10}$/.test(titleId), getNextPageParam: last => last.next || undefined, staleTime: 60000 })
}
