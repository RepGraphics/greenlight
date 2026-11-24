export const defaultButtonMapping: Record<string, string> = {
    "A": "0",
    "B": "1",
    "X": "2",
    "Y": "3",
    "LeftShoulder": "4",
    "RightShoulder": "5",
    "LeftTrigger": "6",
    "RightTrigger": "7",
    "View": "8",
    "Menu": "9",
    "LeftThumb": "10",
    "RightThumb": "11",
    "DPadUp": "12",
    "DPadDown": "13",
    "DPadLeft": "14",
    "DPadRight": "15",
    "Nexus": "16"
}

export function validateButtonMapping(value: unknown): Record<string, string> {
    const mapping = { ...defaultButtonMapping }
    if (!value || typeof value !== 'object') return mapping
    for (const key of Object.keys(mapping)) {
        const candidate = (value as Record<string, unknown>)[key]
        if (typeof candidate === 'string' && /^(?:[0-9]|[1-5][0-9]|6[0-3])$/.test(candidate)) mapping[key] = candidate
    }
    return mapping
}
