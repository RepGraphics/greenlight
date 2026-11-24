export function recommendDeadzone(samples: readonly (readonly number[])[]): number | null {
    if (samples.length < 20 || samples.some(sample => sample.length < 4 || sample.slice(0,4).some(value => !Number.isFinite(value)))) return null
    const peaks = samples.map(sample => Math.max(...sample.slice(0,4).map(Math.abs))).sort((a,b)=>a-b)
    const peak = peaks[Math.ceil(peaks.length*0.95)-1]
    // Large movement during a rest test is not a reliable drift measurement.
    if (peaks[peaks.length-1] > 0.35) return null
    return Math.min(0.5,Math.max(0.03,Math.ceil((peak+0.02)*100-1e-9)/100))
}
