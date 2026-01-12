interface ElevationPoint {
  distance: number
  elevation: number
}

export function calculateElevationGain(elevation: ElevationPoint[]): number {
  let gain = 0
  for (let i = 1; i < elevation.length; i++) {
    const diff = elevation[i].elevation - elevation[i - 1].elevation
    if (diff > 0) gain += diff
  }
  return gain
}
