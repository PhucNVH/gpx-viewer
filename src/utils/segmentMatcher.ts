import type { GpxTrack, MatchedSegment, ElevationPoint } from '../types'
import { haversineDistance } from './distance'

/**
 * Calculate the bearing between two points in degrees (0-360)
 */
function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => deg * (Math.PI / 180)
  const toDeg = (rad: number) => rad * (180 / Math.PI)
  
  const dLon = toRad(lon2 - lon1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  
  let bearing = toDeg(Math.atan2(y, x))
  return (bearing + 360) % 360
}

/**
 * Check if two bearings are similar (within tolerance)
 * Handles wrap-around at 360 degrees
 */
function bearingsAreSimilar(bearing1: number, bearing2: number, tolerance: number = 45): boolean {
  let diff = Math.abs(bearing1 - bearing2)
  if (diff > 180) {
    diff = 360 - diff
  }
  return diff <= tolerance
}

/**
 * Find the nearest point in track B to a given point from track A
 * Returns the index and distance if within delta, otherwise null
 */
function findNearestPointWithinDelta(
  point: ElevationPoint,
  trackBPoints: ElevationPoint[],
  deltaMeters: number,
  startSearchIdx: number = 0
): { index: number; distance: number } | null {
  const deltaKm = deltaMeters / 1000
  let nearestIdx = -1
  let nearestDist = Infinity
  
  // Search in a window around the expected position for efficiency
  const searchWindow = Math.min(500, trackBPoints.length)
  const startIdx = Math.max(0, startSearchIdx - searchWindow / 2)
  const endIdx = Math.min(trackBPoints.length, startSearchIdx + searchWindow)
  
  for (let i = startIdx; i < endIdx; i++) {
    const dist = haversineDistance(
      point.lat, point.lng,
      trackBPoints[i].lat, trackBPoints[i].lng
    )
    
    if (dist < nearestDist && dist <= deltaKm) {
      nearestDist = dist
      nearestIdx = i
    }
  }
  
  if (nearestIdx === -1) return null
  return { index: nearestIdx, distance: nearestDist }
}

interface MatchingPoint {
  pointA: ElevationPoint
  pointB: ElevationPoint
  indexA: number
  indexB: number
}

/**
 * Group consecutive matching points into segments
 * Minimum 3 consecutive points to form a segment
 */
function groupIntoSegments(
  matchingPoints: MatchingPoint[],
  trackA: GpxTrack,
  trackB: GpxTrack
): MatchedSegment[] {
  if (matchingPoints.length < 3) return []
  
  const segments: MatchedSegment[] = []
  let currentSegmentPoints: MatchingPoint[] = []
  
  for (let i = 0; i < matchingPoints.length; i++) {
    const current = matchingPoints[i]
    
    if (currentSegmentPoints.length === 0) {
      currentSegmentPoints.push(current)
    } else {
      const lastPoint = currentSegmentPoints[currentSegmentPoints.length - 1]
      // Check if this point is consecutive (within 5 indices gap)
      const isConsecutive = 
        Math.abs(current.indexA - lastPoint.indexA) <= 5 &&
        Math.abs(current.indexB - lastPoint.indexB) <= 5
      
      if (isConsecutive) {
        currentSegmentPoints.push(current)
      } else {
        // End current segment and start new one
        if (currentSegmentPoints.length >= 3) {
          segments.push(createSegment(currentSegmentPoints, trackA, trackB))
        }
        currentSegmentPoints = [current]
      }
    }
  }
  
  // Don't forget the last segment
  if (currentSegmentPoints.length >= 3) {
    segments.push(createSegment(currentSegmentPoints, trackA, trackB))
  }
  
  return segments
}

/**
 * Create a MatchedSegment from a list of matching points
 */
function createSegment(
  matchingPoints: MatchingPoint[],
  trackA: GpxTrack,
  trackB: GpxTrack
): MatchedSegment {
  // Use the midpoint between track A and track B points for the segment line
  const points = matchingPoints.map(mp => ({
    lat: (mp.pointA.lat + mp.pointB.lat) / 2,
    lng: (mp.pointA.lng + mp.pointB.lng) / 2
  }))
  
  // Calculate segment distance
  let distance = 0
  for (let i = 1; i < points.length; i++) {
    distance += haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    )
  }
  
  return {
    id: `${trackA.id}-${trackB.id}-${matchingPoints[0].indexA}`,
    trackAId: trackA.id,
    trackBId: trackB.id,
    trackAName: trackA.name,
    trackBName: trackB.name,
    points,
    distance
  }
}

/**
 * Find matching segments between two tracks
 */
function findMatchesBetweenTracks(
  trackA: GpxTrack,
  trackB: GpxTrack,
  deltaMeters: number
): MatchedSegment[] {
  const pointsA = trackA.elevation
  const pointsB = trackB.elevation
  
  if (pointsA.length < 3 || pointsB.length < 3) return []
  
  const matchingPoints: MatchingPoint[] = []
  let lastMatchedIdxB = 0
  
  for (let i = 0; i < pointsA.length; i++) {
    const pointA = pointsA[i]
    
    // Find nearest point in track B
    const nearest = findNearestPointWithinDelta(
      pointA,
      pointsB,
      deltaMeters,
      lastMatchedIdxB
    )
    
    if (!nearest) continue
    
    const pointB = pointsB[nearest.index]
    
    // Check direction similarity (need at least 2 points)
    if (i > 0 && nearest.index > 0) {
      const bearingA = calculateBearing(
        pointsA[i - 1].lat, pointsA[i - 1].lng,
        pointA.lat, pointA.lng
      )
      const bearingB = calculateBearing(
        pointsB[nearest.index - 1].lat, pointsB[nearest.index - 1].lng,
        pointB.lat, pointB.lng
      )
      
      if (!bearingsAreSimilar(bearingA, bearingB)) {
        continue
      }
    }
    
    matchingPoints.push({
      pointA,
      pointB,
      indexA: i,
      indexB: nearest.index
    })
    
    lastMatchedIdxB = nearest.index
  }
  
  return groupIntoSegments(matchingPoints, trackA, trackB)
}

/**
 * Find all matching segments across multiple tracks
 * @param tracks Array of GPX tracks to compare
 * @param deltaMeters Distance threshold in meters for matching
 * @returns Array of matched segments
 */
export function findMatchingSegments(
  tracks: GpxTrack[],
  deltaMeters: number
): MatchedSegment[] {
  const visibleTracks = tracks.filter(t => t.visible)
  
  if (visibleTracks.length < 2) return []
  
  const allSegments: MatchedSegment[] = []
  
  // Compare each pair of tracks
  for (let i = 0; i < visibleTracks.length; i++) {
    for (let j = i + 1; j < visibleTracks.length; j++) {
      const segments = findMatchesBetweenTracks(
        visibleTracks[i],
        visibleTracks[j],
        deltaMeters
      )
      allSegments.push(...segments)
    }
  }
  
  return allSegments
}
