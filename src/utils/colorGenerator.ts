// Predefined color palette with good contrast on dark backgrounds
const TRACK_COLORS = [
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#06b6d4', // cyan-500
  '#a855f7', // purple-500
  '#f59e0b', // amber-500
  '#10b981', // emerald-500
]

let colorIndex = 0

/**
 * Get the next color from the palette
 * Cycles through colors when all have been used
 */
export function getNextColor(): string {
  const color = TRACK_COLORS[colorIndex % TRACK_COLORS.length]
  colorIndex++
  return color
}

/**
 * Reset the color index (useful for testing or clearing all tracks)
 */
export function resetColorIndex(): void {
  colorIndex = 0
}
