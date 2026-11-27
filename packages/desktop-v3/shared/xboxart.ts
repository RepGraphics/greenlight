const imageHosts = new Set([
    'store-images.s-microsoft.com',
    'images-eds-ssl.xboxlive.com',
    'images-eds.xboxlive.com',
    'avatar-ssl.xboxlive.com',
])

export function xboxImage(value: unknown) {
    if (typeof value !== 'string' || value.length > 2048) return undefined
    try {
        const url = new URL(value.startsWith('//') ? 'https:' + value : value)
        if (url.protocol === 'https:' && imageHosts.has(url.hostname) && !url.port && !url.username && !url.password) {
            return url.href
        }
    } catch {
        return undefined
    }
    return undefined
}
