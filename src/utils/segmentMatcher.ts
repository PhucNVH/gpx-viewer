import type { GpxTrack, MatchedSegment, ElevationPoint, MatchingAlgorithm } from '../types'
import { haversineDistance } from './distance'
import { getSpatialGrid } from './spatialIndex'

// Configuration constants
const MIN_SEGMENT_POINTS = 8 // Minimum points to form a valid segment (reduced for better coverage)
const MIN_SEGMENT_DISTANCE_KM = 0.08 // Minimum 80m for a segment to be valid
const POINT_SAMPLE_RATE = 3 // Standard algorithm sample rate
const MAX_INDEX_GAP = 30 // Max allowed gap between consecutive matching points (increased)
const MERGE_GAP_KM = 0.25 // Merge segments within 250m of each other (more aggressive)
const OVERLAP_THRESHOLD = 0.2 // If 20% of points overlap, consider segments as duplicates

// Adaptive sampling config
const ADAPTIVE_MIN_RATE = 1 // Sample every point for short tracks
const ADAPTIVE_MAX_RATE = 5 // Max skip for very long tracks
const ADAPTIVE_TARGET_POINTS = 500 // Target number of sampled points

/**
 * Calculate adaptive sample rate based on track length
 * Shorter tracks get denser sampling, longer tracks get sparser
 */
function getAdaptiveSampleRate(trackLength: number): number {
  if (trackLength <= ADAPTIVE_TARGET_POINTS) {
    return ADAPTIVE_MIN_RATE // Sample every point for short tracks
  }
  const rate = Math.ceil(trackLength / ADAPTIVE_TARGET_POINTS)
  return Math.min(rate, ADAPTIVE_MAX_RATE)
}

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
 * Check if two bearings are similar (within tolerance) - SAME DIRECTION ONLY
 * Does NOT match opposite directions (180 degree difference)
 * Handles wrap-around at 360 degrees
 */
function bearingsAreSimilar(bearing1: number, bearing2: number, tolerance: number = 45): boolean {
  let diff = Math.abs(bearing1 - bearing2)
  if (diff > 180) {
    diff = 360 - diff
  }
  // Only match if bearings are within tolerance (same direction)
  // This excludes opposite directions which would have diff close to 180
  return diff <= tolerance
}

/**
 * Convert bearing (0-360) to compass direction label
 */
function bearingToDirection(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(bearing / 45) % 8
  return directions[index]
}

/**
 * Calculate the overall direction of a segment from its points
 */
function calculateSegmentDirection(points: Array<{ lat: number; lng: number }>): { bearing: number; label: string } {
  if (points.length < 2) {
    return { bearing: 0, label: 'N' }
  }
  
  // Calculate bearing from first to last point for overall direction
  const start = points[0]
  const end = points[points.length - 1]
  
  const bearing = calculateBearing(start.lat, start.lng, end.lat, end.lng)
  const label = bearingToDirection(bearing)
  
  return { bearing, label }
}

/**
 * Find the nearest point in track B to a given point from track A
 * Uses spatial grid for O(1) average lookup instead of O(n)
 */
function findNearestPointWithinDelta(
  point: ElevationPoint,
  trackBId: string,
  trackBPoints: ElevationPoint[],
  deltaKm: number
): { index: number; distance: number } | null {
  // Use spatial grid for fast lookup - cell size is slightly larger than delta for safety
  const grid = getSpatialGrid(trackBId, trackBPoints, Math.max(deltaKm * 2, 0.5))
  return grid.findNearestWithinDistance(point.lat, point.lng, deltaKm, haversineDistance)
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
  tolerance: number = 0.000015 // ~1.5m tolerance (reduced for smoother paths)
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

/**
 * Smooth a polyline by averaging nearby points (moving average)
 */
function smoothPolyline(
  points: Array<{ lat: number; lng: number }>,
  windowSize: number = 3
): Array<{ lat: number; lng: number }> {
  if (points.length <= windowSize) return points
  
  const smoothed: Array<{ lat: number; lng: number }> = []
  const halfWindow = Math.floor(windowSize / 2)
  
  for (let i = 0; i < points.length; i++) {
    let sumLat = 0
    let sumLng = 0
    let count = 0
    
    for (let j = Math.max(0, i - halfWindow); j <= Math.min(points.length - 1, i + halfWindow); j++) {
      sumLat += points[j].lat
      sumLng += points[j].lng
      count++
    }
    
    smoothed.push({
      lat: sumLat / count,
      lng: sumLng / count
    })
  }
  
  // Keep original start and end points for accuracy
  smoothed[0] = points[0]
  smoothed[smoothed.length - 1] = points[points.length - 1]
  
  return smoothed
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
  trackB: GpxTrack,
  algorithm: MatchingAlgorithm = 'standard'
): MatchedSegment[] {
  if (matchingPoints.length < MIN_SEGMENT_POINTS) return []
  
  // In bidirectional mode, allow opposite progressions
  const allowOppositeProgression = algorithm === 'bidirectional'
  
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
      
      // In bidirectional mode, allow opposite progressions (e.g., uphill vs downhill)
      const progressionOk = allowOppositeProgression || sameProgression
      
      const isConsecutive = 
        indexGapA <= MAX_INDEX_GAP &&
        indexGapB <= MAX_INDEX_GAP &&
        progressionOk
      
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
  
  // First pass: merge nearby sequential segments
  const nearbyMerged = mergeNearbySegments(rawSegments)
  
  // Second pass: merge overlapping segments (more aggressive in bidirectional mode)
  const fullyMerged = mergeOverlappingSegments(nearbyMerged, algorithm)
  
  // Convert to MatchedSegment objects and filter by minimum distance
  const segments: MatchedSegment[] = []
  
  for (const segmentPoints of fullyMerged) {
    const segment = createSegment(segmentPoints, trackA, trackB)
    if (segment.distance >= MIN_SEGMENT_DISTANCE_KM) {
      segments.push(segment)
    }
  }
  
  return segments
}

/**
 * Merge segments that are close together (sequential merge)
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
 * Calculate the average bearing/direction of a segment
 */
function calculateSegmentBearing(segment: MatchingPoint[]): number {
  if (segment.length < 2) return 0

  // Use first and last points for overall direction
  const first = segment[0]
  const last = segment[segment.length - 1]

  return calculateBearing(
    first.pointA.lat,
    first.pointA.lng,
    last.pointA.lat,
    last.pointA.lng
  )
}

/**
 * Check if two segments have similar directions (not opposite)
 */
function segmentsHaveSameDirection(
  seg1: MatchingPoint[],
  seg2: MatchingPoint[],
  tolerance: number = 60
): boolean {
  const bearing1 = calculateSegmentBearing(seg1)
  const bearing2 = calculateSegmentBearing(seg2)

  return bearingsAreSimilar(bearing1, bearing2, tolerance)
}

/**
 * Check if two segments overlap significantly based on their index ranges
 */
function segmentsOverlap(
  seg1: MatchingPoint[],
  seg2: MatchingPoint[],
  skipDirectionCheck: boolean = false
): boolean {
  // Check direction unless in bidirectional mode
  if (!skipDirectionCheck && !segmentsHaveSameDirection(seg1, seg2)) {
    return false
  }

  // Get index ranges for both segments
  const seg1StartA = Math.min(...seg1.map(p => p.indexA))
  const seg1EndA = Math.max(...seg1.map(p => p.indexA))
  const seg2StartA = Math.min(...seg2.map(p => p.indexA))
  const seg2EndA = Math.max(...seg2.map(p => p.indexA))
  
  // Calculate overlap
  const overlapStart = Math.max(seg1StartA, seg2StartA)
  const overlapEnd = Math.min(seg1EndA, seg2EndA)
  
  if (overlapEnd < overlapStart) return false // No overlap
  
  const overlapLength = overlapEnd - overlapStart
  const seg1Length = seg1EndA - seg1StartA
  const seg2Length = seg2EndA - seg2StartA
  const minLength = Math.min(seg1Length, seg2Length)
  
  // If overlap is significant portion of smaller segment
  return minLength > 0 && (overlapLength / minLength) >= OVERLAP_THRESHOLD
}

/**
 * Check if two segments are spatially close AND going the same direction
 */
function segmentsAreSpatiallyClose(
  seg1: MatchingPoint[],
  seg2: MatchingPoint[],
  skipDirectionCheck: boolean = false
): boolean {
  // Check direction unless in bidirectional mode
  if (!skipDirectionCheck && !segmentsHaveSameDirection(seg1, seg2)) {
    return false
  }

  const seg1Start = seg1[0]
  const seg1End = seg1[seg1.length - 1]
  const seg2Start = seg2[0]
  const seg2End = seg2[seg2.length - 1]
  
  // Check if any endpoints are close to each other
  const distStartStart = haversineDistance(
    seg1Start.pointA.lat, seg1Start.pointA.lng,
    seg2Start.pointA.lat, seg2Start.pointA.lng
  )
  const distEndEnd = haversineDistance(
    seg1End.pointA.lat, seg1End.pointA.lng,
    seg2End.pointA.lat, seg2End.pointA.lng
  )
  const distStartEnd = haversineDistance(
    seg1Start.pointA.lat, seg1Start.pointA.lng,
    seg2End.pointA.lat, seg2End.pointA.lng
  )
  const distEndStart = haversineDistance(
    seg1End.pointA.lat, seg1End.pointA.lng,
    seg2Start.pointA.lat, seg2Start.pointA.lng
  )
  
  // If any pair of endpoints is within merge distance
  const minDist = Math.min(distStartStart, distEndEnd, distStartEnd, distEndStart)
  return minDist <= MERGE_GAP_KM * 2
}

/**
 * Merge two segment point arrays into one, removing duplicates and sorting by index
 */
function mergeSegmentPoints(seg1: MatchingPoint[], seg2: MatchingPoint[]): MatchingPoint[] {
  const pointMap = new Map<number, MatchingPoint>()
  
  // Add all points from both segments, using indexA as key
  for (const point of seg1) {
    pointMap.set(point.indexA, point)
  }
  for (const point of seg2) {
    // Only add if not already present (prefer earlier segment's point)
    if (!pointMap.has(point.indexA)) {
      pointMap.set(point.indexA, point)
    }
  }
  
  // Sort by indexA and return
  return Array.from(pointMap.values()).sort((a, b) => a.indexA - b.indexA)
}

/**
 * Advanced segment merging: merge overlapping and nearby segments
 */
function mergeOverlappingSegments(
  segments: MatchingPoint[][],
  algorithm: MatchingAlgorithm = 'standard'
): MatchingPoint[][] {
  if (segments.length <= 1) return segments
  
  // In bidirectional mode, skip direction checks when merging
  const skipDirectionCheck = algorithm === 'bidirectional'
  
  // Sort segments by their start index
  const sorted = [...segments].sort((a, b) => {
    const aStart = Math.min(...a.map(p => p.indexA))
    const bStart = Math.min(...b.map(p => p.indexA))
    return aStart - bStart
  })
  
  const result: MatchingPoint[][] = []
  let current = sorted[0]
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    
    // Check if segments should be merged
    if (
      segmentsOverlap(current, next, skipDirectionCheck) || 
      segmentsAreSpatiallyClose(current, next, skipDirectionCheck)
    ) {
      // Merge the segments
      current = mergeSegmentPoints(current, next)
    } else {
      // Save current and move to next
      if (current.length >= MIN_SEGMENT_POINTS) {
        result.push(current)
      }
      current = next
    }
  }
  
  // Don't forget the last segment
  if (current.length >= MIN_SEGMENT_POINTS) {
    result.push(current)
  }
  
  return result
}

/**
 * Create a MatchedSegment from a list of matching points
 * Uses actual track A points for smoother, more accurate path representation
 */
function createSegment(
  matchingPoints: MatchingPoint[],
  trackA: GpxTrack,
  trackB: GpxTrack
): MatchedSegment {
  // Sort matching points by indexA to ensure proper order
  const sortedPoints = [...matchingPoints].sort((a, b) => a.indexA - b.indexA)
  
  // Get the full range of track A points for smoother path
  const startIdxA = sortedPoints[0].indexA
  const endIdxA = sortedPoints[sortedPoints.length - 1].indexA

  // Get track B indices
  const sortedByB = [...matchingPoints].sort((a, b) => a.indexB - b.indexB)
  const startIdxB = sortedByB[0].indexB
  const endIdxB = sortedByB[sortedByB.length - 1].indexB
  
  // Extract all track A points in the range for smooth path
  const trackAPoints = trackA.elevation
  const rawPoints: Array<{ lat: number; lng: number }> = []
  
  for (let i = startIdxA; i <= endIdxA && i < trackAPoints.length; i++) {
    rawPoints.push({
      lat: trackAPoints[i].lat,
      lng: trackAPoints[i].lng
    })
  }
  
  // If we don't have enough points, fall back to matching points
  if (rawPoints.length < 2) {
    for (const mp of sortedPoints) {
      rawPoints.push({ lat: mp.pointA.lat, lng: mp.pointA.lng })
    }
  }
  
  // Apply smoothing first, then simplify
  const smoothed = smoothPolyline(rawPoints, 5)
  const points = simplifyPolyline(smoothed)
  
  // Calculate segment distance using raw points for accuracy
  let distance = 0
  for (let i = 1; i < rawPoints.length; i++) {
    distance += haversineDistance(
      rawPoints[i - 1].lat, rawPoints[i - 1].lng,
      rawPoints[i].lat, rawPoints[i].lng
    )
  }
  
  // Calculate segment direction
  const { bearing, label } = calculateSegmentDirection(points)
  
  return {
    id: `${trackA.id}-${trackB.id}-${matchingPoints[0].indexA}`,
    trackAId: trackA.id,
    trackBId: trackB.id,
    trackAName: trackA.name,
    trackBName: trackB.name,
    points,
    distance,
    direction: bearing,
    directionLabel: label,
    startIndexA: startIdxA,
    endIndexA: endIdxA,
    startIndexB: startIdxB,
    endIndexB: endIdxB,
  }
}

/**
 * Find matching segments between two tracks
 */
function findMatchesBetweenTracks(
  trackA: GpxTrack,
  trackB: GpxTrack,
  deltaMeters: number,
  algorithm: MatchingAlgorithm = 'standard'
): MatchedSegment[] {
  const pointsA = trackA.elevation
  const pointsB = trackB.elevation
  
  if (pointsA.length < MIN_SEGMENT_POINTS || pointsB.length < MIN_SEGMENT_POINTS) {
    return []
  }
  
  const deltaKm = deltaMeters / 1000
  const matchingPoints: MatchingPoint[] = []
  
  // Determine sample rate based on algorithm
  const sampleRate = algorithm === 'standard' 
    ? POINT_SAMPLE_RATE 
    : getAdaptiveSampleRate(pointsA.length)
  
  // Bidirectional mode skips bearing check entirely
  const checkBearing = algorithm !== 'bidirectional'
  
  // Sample points for efficiency
  for (let i = 0; i < pointsA.length; i += sampleRate) {
    const pointA = pointsA[i]
    
    // Find nearest point in track B using spatial index
    const nearest = findNearestPointWithinDelta(pointA, trackB.id, pointsB, deltaKm)
    
    if (!nearest) continue
    
    const pointB = pointsB[nearest.index]
    
    // Only check bearing if not in bidirectional mode
    if (checkBearing && i > 0 && nearest.index > 0) {
      const prevIdxA = Math.max(0, i - sampleRate)
      const prevIdxB = Math.max(0, nearest.index - sampleRate)
      
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
  
  return groupIntoSegments(matchingPoints, trackA, trackB, algorithm)
}

/**
 * Find all matching segments across multiple tracks
 * @param tracks Array of GPX tracks to compare
 * @param deltaMeters Distance threshold in meters for matching
 * @param algorithm Matching algorithm to use ('standard', 'adaptive', or 'bidirectional')
 * @returns Array of matched segments
 */
export function findMatchingSegments(
  tracks: GpxTrack[],
  deltaMeters: number,
  algorithm: MatchingAlgorithm = 'standard'
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
        deltaMeters,
        algorithm
      )
      allSegments.push(...segments)
    }
  }
  
  // Sort by distance descending (show longest matches first in summary)
  return allSegments.sort((a, b) => b.distance - a.distance)
}
