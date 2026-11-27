const defaultDeviceSignIn = 'https://microsoft.com/devicelogin'
const xboxDeviceSignIn = 'https://www.microsoft.com/link'

export function deviceSignInUrl(value: unknown) {
    if (typeof value !== 'string') return defaultDeviceSignIn
    try {
        const url = new URL(value)
        if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash) {
            return defaultDeviceSignIn
        }
        if ((url.hostname === 'microsoft.com' || url.hostname === 'www.microsoft.com') && /^\/link\/?$/.test(url.pathname)) {
            return xboxDeviceSignIn
        }
    } catch {
        return defaultDeviceSignIn
    }
    return defaultDeviceSignIn
}

export function isDeviceSignInUrl(url: string) {
    return url === defaultDeviceSignIn || url === xboxDeviceSignIn
}
