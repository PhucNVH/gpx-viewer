import type { GpxTrack, MatchedSegment, ElevationPoint } from '../types'
import { haversineDistance } from './distance'

// Configuration constants
const MIN_SEGMENT_POINTS = 10 // Minimum points to form a valid segment
const MIN_SEGMENT_DISTANCE_KM = 0.1 // Minimum 100m for a segment to be valid
const POINT_SAMPLE_RATE = 3 // Sample every Nth point for efficiency
const MAX_INDEX_GAP = 10 // Max allowed gap between consecutive matching points
const MERGE_GAP_KM = 0.05 // Merge segments within 50m of each other

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
function bearingsAreSimilar(bearing1: number, bearing2: number, tolerance: number = 60): boolean {
  let diff = Math.abs(bearing1 - bearing2)
  if (diff > 180) {
    diff = 360 - diff
  }
  return diff <= tolerance
}

/**
 * Find the nearest point in track B to a given point from track A
 * Searches the entire track B for better accuracy
 */
function findNearestPointWithinDelta(
  point: ElevationPoint,
  trackBPoints: ElevationPoint[],
  deltaKm: number
): { index: number; distance: number } | null {
  let nearestIdx = -1
  let nearestDist = Infinity
  
  for (let i = 0; i < trackBPoints.length; i++) {
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
 * Simplify a polyline using Douglas-Peucker algorithm
 * Reduces the number of points while preserving shape
 */
function simplifyPolyline(
  points: Array<{ lat: number; lng: number }>,
  tolerance: number = 0.00005 // ~5m tolerance
): Array<{ lat: number; lng: number }> {
  if (points.length <= 2) return points
  
  // Find the point with maximum distance from line between first and last
  let maxDist = 0
  let maxIdx = 0
  
  const start = points[0]
  const end = points[points.length - 1]
  
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end)
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }
  
  if (maxDist > tolerance) {
    // Recursively simplify
    const left = simplifyPolyline(points.slice(0, maxIdx + 1), tolerance)
    const right = simplifyPolyline(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  
  return [start, end]
}

function perpendicularDistance(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number }
): number {
  const dx = lineEnd.lng - lineStart.lng
  const dy = lineEnd.lat - lineStart.lat
  
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return haversineDistance(point.lat, point.lng, lineStart.lat, lineStart.lng)
  
  const t = Math.max(0, Math.min(1, 
    ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / (len * len)
  ))
  
  const projLng = lineStart.lng + t * dx
  const projLat = lineStart.lat + t * dy
  
  return Math.sqrt(
    Math.pow(point.lng - projLng, 2) + Math.pow(point.lat - projLat, 2)
  )
}

/**
 * Group consecutive matching points into segments with improved logic
 */
function groupIntoSegments(
  matchingPoints: MatchingPoint[],
  trackA: GpxTrack,
  trackB: GpxTrack
): MatchedSegment[] {
  if (matchingPoints.length < MIN_SEGMENT_POINTS) return []
  
  const rawSegments: MatchingPoint[][] = []
  let currentSegmentPoints: MatchingPoint[] = []
  
  for (let i = 0; i < matchingPoints.length; i++) {
    const current = matchingPoints[i]
    
    if (currentSegmentPoints.length === 0) {
      currentSegmentPoints.push(current)
    } else {
      const lastPoint = currentSegmentPoints[currentSegmentPoints.length - 1]
      
      // Check if indices are reasonably consecutive
      const indexGapA = Math.abs(current.indexA - lastPoint.indexA)
      const indexGapB = Math.abs(current.indexB - lastPoint.indexB)
      
      // Check if tracks are progressing in same direction (not jumping around)
      const isProgressingA = current.indexA > lastPoint.indexA
      const isProgressingB = current.indexB > lastPoint.indexB
      const sameProgression = isProgressingA === isProgressingB
      
      const isConsecutive = 
        indexGapA <= MAX_INDEX_GAP &&
        indexGapB <= MAX_INDEX_GAP &&
        sameProgression
      
      if (isConsecutive) {
        currentSegmentPoints.push(current)
      } else {
        // End current segment and start new one
        if (currentSegmentPoints.length >= MIN_SEGMENT_POINTS) {
          rawSegments.push([...currentSegmentPoints])
        }
        currentSegmentPoints = [current]
      }
    }
  }
  
  // Don't forget the last segment
  if (currentSegmentPoints.length >= MIN_SEGMENT_POINTS) {
    rawSegments.push(currentSegmentPoints)
  }
  
  // Merge nearby segments
  const mergedSegments = mergeNearbySegments(rawSegments)
  
  // Convert to MatchedSegment objects and filter by minimum distance
  const segments: MatchedSegment[] = []
  
  for (const segmentPoints of mergedSegments) {
    const segment = createSegment(segmentPoints, trackA, trackB)
    if (segment.distance >= MIN_SEGMENT_DISTANCE_KM) {
      segments.push(segment)
    }
  }
  
  return segments
}

/**
 * Merge segments that are close together
 */
function mergeNearbySegments(segments: MatchingPoint[][]): MatchingPoint[][] {
  if (segments.length <= 1) return segments
  
  const merged: MatchingPoint[][] = []
  let currentMerged = [...segments[0]]
  
  for (let i = 1; i < segments.length; i++) {
    const prevEnd = currentMerged[currentMerged.length - 1]
    const nextStart = segments[i][0]
    
    // Calculate gap distance
    const gapDist = haversineDistance(
      prevEnd.pointA.lat, prevEnd.pointA.lng,
      nextStart.pointA.lat, nextStart.pointA.lng
    )
    
    if (gapDist <= MERGE_GAP_KM) {
      // Merge segments
      currentMerged.push(...segments[i])
    } else {
      // Save current and start new
      if (currentMerged.length >= MIN_SEGMENT_POINTS) {
        merged.push(currentMerged)
      }
      currentMerged = [...segments[i]]
    }
  }
  
  if (currentMerged.length >= MIN_SEGMENT_POINTS) {
    merged.push(currentMerged)
  }
  
  return merged
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
  const rawPoints = matchingPoints.map(mp => ({
    lat: (mp.pointA.lat + mp.pointB.lat) / 2,
    lng: (mp.pointA.lng + mp.pointB.lng) / 2
  }))
  
  // Simplify the polyline to reduce point count
  const points = simplifyPolyline(rawPoints)
  
  // Calculate segment distance using raw points for accuracy
  let distance = 0
  for (let i = 1; i < rawPoints.length; i++) {
    distance += haversineDistance(
      rawPoints[i - 1].lat, rawPoints[i - 1].lng,
      rawPoints[i].lat, rawPoints[i].lng
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
  
  if (pointsA.length < MIN_SEGMENT_POINTS || pointsB.length < MIN_SEGMENT_POINTS) {
    return []
  }
  
  const deltaKm = deltaMeters / 1000
  const matchingPoints: MatchingPoint[] = []
  
  // Sample points for efficiency
  for (let i = 0; i < pointsA.length; i += POINT_SAMPLE_RATE) {
    const pointA = pointsA[i]
    
    // Find nearest point in track B
    const nearest = findNearestPointWithinDelta(pointA, pointsB, deltaKm)
    
    if (!nearest) continue
    
    const pointB = pointsB[nearest.index]
    
    // Check direction similarity using nearby points
    const prevIdxA = Math.max(0, i - POINT_SAMPLE_RATE)
    const prevIdxB = Math.max(0, nearest.index - POINT_SAMPLE_RATE)
    
    if (i > 0 && nearest.index > 0) {
      const bearingA = calculateBearing(
        pointsA[prevIdxA].lat, pointsA[prevIdxA].lng,
        pointA.lat, pointA.lng
      )
      const bearingB = calculateBearing(
        pointsB[prevIdxB].lat, pointsB[prevIdxB].lng,
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
  
  // Sort by distance descending (show longest matches first in summary)
  return allSegments.sort((a, b) => b.distance - a.distance)
}
