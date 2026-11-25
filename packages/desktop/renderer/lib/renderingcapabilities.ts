export type RenderingCapabilities = {
    displayHdr: boolean | null
    videoHdr: boolean | null
    wideGamut: boolean | null
    webGpuApi: boolean | null
    codecs: string[] | null
}

type Probe = {
    matchMedia?: (query: string) => { matches: boolean }
    webGpu?: boolean
    codecs?: () => ReadonlyArray<{ mimeType: string }> | undefined
}

// Display and API hints are not proof of HDR negotiation or playback.
export function inspectRenderingCapabilities(probe: Probe): RenderingCapabilities {
    const matches = (query: string): boolean | null => {
        try { return probe.matchMedia?.(query).matches ?? null } catch { return null }
    }
    const range = (feature: string): boolean | null => {
        const high = matches(`(${feature}: high)`)
        if (high) return true
        return matches(`(${feature}: standard)`) ? false : null
    }
    let codecs: string[] | null = null
    try {
        const entries = probe.codecs?.()
        if (entries) codecs = [...new Set(entries.map(entry => entry.mimeType.toLowerCase()).filter(name => /^video\/[a-z0-9.+-]+$/.test(name)))].sort()
    } catch { /* unavailable */ }
    return {
        displayHdr: range('dynamic-range'),
        videoHdr: range('video-dynamic-range'),
        wideGamut: matches('(color-gamut: p3)') === true ? true : matches('(color-gamut: srgb)') === true ? false : null,
        webGpuApi: probe.webGpu ?? null,
        codecs,
    }
}
