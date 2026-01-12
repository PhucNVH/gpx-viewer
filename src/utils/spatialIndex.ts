import type { ElevationPoint } from '../types'

/**
 * A simple spatial grid index for fast nearest-neighbor lookups
 * Divides the space into cells and only searches relevant cells
 */
export class SpatialGrid {
  private grid: Map<string, { point: ElevationPoint; index: number }[]>
  private cellSize: number // in degrees
  private points: ElevationPoint[]

  constructor(points: ElevationPoint[], cellSizeKm: number = 0.5) {
    this.points = points
    // Convert km to approximate degrees (1 degree ≈ 111 km at equator)
    this.cellSize = cellSizeKm / 111
    this.grid = new Map()
    this.buildIndex()
  }

  private getCellKey(lat: number, lng: number): string {
    const cellX = Math.floor(lng / this.cellSize)
    const cellY = Math.floor(lat / this.cellSize)
    return `${cellX},${cellY}`
  }

  private buildIndex(): void {
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i]
      const key = this.getCellKey(point.lat, point.lng)
      
      if (!this.grid.has(key)) {
        this.grid.set(key, [])
      }
      this.grid.get(key)!.push({ point, index: i })
    }
  }

  /**
   * Find the nearest point within a given distance
   * Only searches cells that could potentially contain matches
   */
  findNearestWithinDistance(
    lat: number,
    lng: number,
    maxDistanceKm: number,
    haversineDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => number
  ): { index: number; distance: number } | null {
    // Calculate how many cells to search in each direction
    const searchRadius = Math.ceil(maxDistanceKm / 111 / this.cellSize)
    
    const centerCellX = Math.floor(lng / this.cellSize)
    const centerCellY = Math.floor(lat / this.cellSize)
    
    let nearestIdx = -1
    let nearestDist = Infinity
    
    // Search neighboring cells
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const key = `${centerCellX + dx},${centerCellY + dy}`
        const cellPoints = this.grid.get(key)
        
        if (!cellPoints) continue
        
        for (const { point, index } of cellPoints) {
          const dist = haversineDistance(lat, lng, point.lat, point.lng)
          
          if (dist < nearestDist && dist <= maxDistanceKm) {
            nearestDist = dist
            nearestIdx = index
          }
        }
      }
    }
    
    if (nearestIdx === -1) return null
    return { index: nearestIdx, distance: nearestDist }
  }
}

/**
 * Cache for spatial grids to avoid rebuilding for the same track
 */
const gridCache = new Map<string, { grid: SpatialGrid; pointCount: number }>()

export function getSpatialGrid(trackId: string, points: ElevationPoint[], cellSizeKm: number = 0.5): SpatialGrid {
  const cached = gridCache.get(trackId)
  
  // Return cached grid if points haven't changed
  if (cached && cached.pointCount === points.length) {
    return cached.grid
  }
  
  // Build new grid
  const grid = new SpatialGrid(points, cellSizeKm)
  gridCache.set(trackId, { grid, pointCount: points.length })
  
  return grid
}

export function clearGridCache(): void {
  gridCache.clear()
}

