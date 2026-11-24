export function statsExpired(now:number,lastStatsAt:number,connectedAt:number):boolean {
    return now-Math.max(lastStatsAt,connectedAt)>=15000
}
