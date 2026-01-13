/// <reference lib="webworker" />

import type { GpxTrack, MatchedSegment, ElevationPoint, MatchingAlgorithm } from "../types";

// Configuration constants
const MIN_SEGMENT_POINTS = 8; // Reduced for better coverage
const MIN_SEGMENT_DISTANCE_KM = 0.08; // Minimum 80m
const POINT_SAMPLE_RATE = 3; // Standard algorithm sample rate
const MAX_INDEX_GAP = 30; // Increased for better merging
const MERGE_GAP_KM = 0.25; // 250m merge distance
const OVERLAP_THRESHOLD = 0.2; // 20% overlap threshold

// Adaptive sampling config
const ADAPTIVE_MIN_RATE = 1; // Sample every point for short tracks
const ADAPTIVE_MAX_RATE = 5; // Max skip for very long tracks
const ADAPTIVE_TARGET_POINTS = 500; // Target number of sampled points

// Haversine distance calculation
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (deg: number) => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Spatial grid for fast nearest-neighbor lookup
class SpatialGrid {
  private grid: Map<string, { point: ElevationPoint; index: number }[]>;
  private cellSize: number;
  private points: ElevationPoint[];

  constructor(points: ElevationPoint[], cellSizeKm: number = 0.5) {
    this.points = points;
    this.cellSize = cellSizeKm / 111;
    this.grid = new Map();
    this.buildIndex();
  }

  private getCellKey(lat: number, lng: number): string {
    const cellX = Math.floor(lng / this.cellSize);
    const cellY = Math.floor(lat / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private buildIndex(): void {
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      const key = this.getCellKey(point.lat, point.lng);

      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key)!.push({ point, index: i });
    }
  }

  findNearestWithinDistance(
    lat: number,
    lng: number,
    maxDistanceKm: number
  ): { index: number; distance: number } | null {
    const searchRadius = Math.ceil(maxDistanceKm / 111 / this.cellSize);
    const centerCellX = Math.floor(lng / this.cellSize);
    const centerCellY = Math.floor(lat / this.cellSize);

    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      for (let dy = -searchRadius; dy <= searchRadius; dy++) {
        const key = `${centerCellX + dx},${centerCellY + dy}`;
        const cellPoints = this.grid.get(key);

        if (!cellPoints) continue;

        for (const { point, index } of cellPoints) {
          const dist = haversineDistance(lat, lng, point.lat, point.lng);

          if (dist < nearestDist && dist <= maxDistanceKm) {
            nearestDist = dist;
            nearestIdx = index;
          }
        }
      }
    }

    if (nearestIdx === -1) return null;
    return { index: nearestIdx, distance: nearestDist };
  }
}

// Cache for spatial grids
const gridCache = new Map<string, { grid: SpatialGrid; pointCount: number }>();

function getSpatialGrid(
  trackId: string,
  points: ElevationPoint[],
  cellSizeKm: number = 0.5
): SpatialGrid {
  const cached = gridCache.get(trackId);
  if (cached && cached.pointCount === points.length) {
    return cached.grid;
  }
  const grid = new SpatialGrid(points, cellSizeKm);
  gridCache.set(trackId, { grid, pointCount: points.length });
  return grid;
}

function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const toDeg = (rad: number) => rad * (180 / Math.PI);

  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

/**
 * Check if two bearings are similar - SAME DIRECTION ONLY
 * Does NOT match opposite directions
 */
function bearingsAreSimilar(
  bearing1: number,
  bearing2: number,
  tolerance: number = 45
): boolean {
  let diff = Math.abs(bearing1 - bearing2);
  if (diff > 180) {
    diff = 360 - diff;
  }
  // Only match same direction, not opposite
  return diff <= tolerance;
}

/**
 * Convert bearing to compass direction label
 */
function bearingToDirection(bearing: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

/**
 * Calculate overall segment direction
 */
function calculateSegmentDirection(
  points: Array<{ lat: number; lng: number }>
): { bearing: number; label: string } {
  if (points.length < 2) {
    return { bearing: 0, label: "N" };
  }

  const start = points[0];
  const end = points[points.length - 1];

  const bearing = calculateBearing(start.lat, start.lng, end.lat, end.lng);
  const label = bearingToDirection(bearing);

  return { bearing, label };
}

interface MatchingPoint {
  pointA: ElevationPoint;
  pointB: ElevationPoint;
  indexA: number;
  indexB: number;
}

function simplifyPolyline(
  points: Array<{ lat: number; lng: number }>,
  tolerance: number = 0.000015 // ~1.5m tolerance for smoother paths
): Array<{ lat: number; lng: number }> {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;

  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPolyline(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPolyline(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

/**
 * Smooth a polyline by averaging nearby points (moving average)
 */
function smoothPolyline(
  points: Array<{ lat: number; lng: number }>,
  windowSize: number = 3
): Array<{ lat: number; lng: number }> {
  if (points.length <= windowSize) return points;

  const smoothed: Array<{ lat: number; lng: number }> = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < points.length; i++) {
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - halfWindow);
      j <= Math.min(points.length - 1, i + halfWindow);
      j++
    ) {
      sumLat += points[j].lat;
      sumLng += points[j].lng;
      count++;
    }

    smoothed.push({
      lat: sumLat / count,
      lng: sumLng / count,
    });
  }

  // Keep original start and end points
  smoothed[0] = points[0];
  smoothed[smoothed.length - 1] = points[points.length - 1];

  return smoothed;
}

function perpendicularDistance(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number }
): number {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;

  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0)
    return haversineDistance(
      point.lat,
      point.lng,
      lineStart.lat,
      lineStart.lng
    );

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) /
        (len * len)
    )
  );

  const projLng = lineStart.lng + t * dx;
  const projLat = lineStart.lat + t * dy;

  return Math.sqrt(
    Math.pow(point.lng - projLng, 2) + Math.pow(point.lat - projLat, 2)
  );
}

function groupIntoSegments(
  matchingPoints: MatchingPoint[],
  trackA: GpxTrack,
  trackB: GpxTrack,
  algorithm: MatchingAlgorithm = 'standard'
): MatchedSegment[] {
  if (matchingPoints.length < MIN_SEGMENT_POINTS) return [];

  // In bidirectional mode, allow opposite progressions
  const allowOppositeProgression = algorithm === 'bidirectional';

  const rawSegments: MatchingPoint[][] = [];
  let currentSegmentPoints: MatchingPoint[] = [];

  for (let i = 0; i < matchingPoints.length; i++) {
    const current = matchingPoints[i];

    if (currentSegmentPoints.length === 0) {
      currentSegmentPoints.push(current);
    } else {
      const lastPoint = currentSegmentPoints[currentSegmentPoints.length - 1];

      const indexGapA = Math.abs(current.indexA - lastPoint.indexA);
      const indexGapB = Math.abs(current.indexB - lastPoint.indexB);

      const isProgressingA = current.indexA > lastPoint.indexA;
      const isProgressingB = current.indexB > lastPoint.indexB;
      const sameProgression = isProgressingA === isProgressingB;

      // In bidirectional mode, allow opposite progressions (e.g., uphill vs downhill)
      const progressionOk = allowOppositeProgression || sameProgression;

      const isConsecutive =
        indexGapA <= MAX_INDEX_GAP &&
        indexGapB <= MAX_INDEX_GAP &&
        progressionOk;

      if (isConsecutive) {
        currentSegmentPoints.push(current);
      } else {
        if (currentSegmentPoints.length >= MIN_SEGMENT_POINTS) {
          rawSegments.push([...currentSegmentPoints]);
        }
        currentSegmentPoints = [current];
      }
    }
  }

  if (currentSegmentPoints.length >= MIN_SEGMENT_POINTS) {
    rawSegments.push(currentSegmentPoints);
  }

  // First pass: merge nearby sequential segments
  const nearbyMerged = mergeNearbySegments(rawSegments);

  // Second pass: merge overlapping segments (more aggressive in bidirectional mode)
  const fullyMerged = mergeOverlappingSegments(nearbyMerged, algorithm);

  const segments: MatchedSegment[] = [];

  for (const segmentPoints of fullyMerged) {
    const segment = createSegment(segmentPoints, trackA, trackB);
    if (segment.distance >= MIN_SEGMENT_DISTANCE_KM) {
      segments.push(segment);
    }
  }

  return segments;
}

function mergeNearbySegments(segments: MatchingPoint[][]): MatchingPoint[][] {
  if (segments.length <= 1) return segments;

  const merged: MatchingPoint[][] = [];
  let currentMerged = [...segments[0]];

  for (let i = 1; i < segments.length; i++) {
    const prevEnd = currentMerged[currentMerged.length - 1];
    const nextStart = segments[i][0];

    const gapDist = haversineDistance(
      prevEnd.pointA.lat,
      prevEnd.pointA.lng,
      nextStart.pointA.lat,
      nextStart.pointA.lng
    );

    if (gapDist <= MERGE_GAP_KM) {
      currentMerged.push(...segments[i]);
    } else {
      if (currentMerged.length >= MIN_SEGMENT_POINTS) {
        merged.push(currentMerged);
      }
      currentMerged = [...segments[i]];
    }
  }

  if (currentMerged.length >= MIN_SEGMENT_POINTS) {
    merged.push(currentMerged);
  }

  return merged;
}

/**
 * Calculate the average bearing/direction of a segment
 */
function calculateSegmentBearing(segment: MatchingPoint[]): number {
  if (segment.length < 2) return 0;

  // Use first and last points for overall direction
  const first = segment[0];
  const last = segment[segment.length - 1];

  return calculateBearing(
    first.pointA.lat,
    first.pointA.lng,
    last.pointA.lat,
    last.pointA.lng
  );
}

/**
 * Check if two segments have similar directions (not opposite)
 */
function segmentsHaveSameDirection(
  seg1: MatchingPoint[],
  seg2: MatchingPoint[],
  tolerance: number = 60
): boolean {
  const bearing1 = calculateSegmentBearing(seg1);
  const bearing2 = calculateSegmentBearing(seg2);

  return bearingsAreSimilar(bearing1, bearing2, tolerance);
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
    return false;
  }

  const seg1StartA = Math.min(...seg1.map((p) => p.indexA));
  const seg1EndA = Math.max(...seg1.map((p) => p.indexA));
  const seg2StartA = Math.min(...seg2.map((p) => p.indexA));
  const seg2EndA = Math.max(...seg2.map((p) => p.indexA));

  const overlapStart = Math.max(seg1StartA, seg2StartA);
  const overlapEnd = Math.min(seg1EndA, seg2EndA);

  if (overlapEnd < overlapStart) return false;

  const overlapLength = overlapEnd - overlapStart;
  const seg1Length = seg1EndA - seg1StartA;
  const seg2Length = seg2EndA - seg2StartA;
  const minLength = Math.min(seg1Length, seg2Length);

  return minLength > 0 && overlapLength / minLength >= OVERLAP_THRESHOLD;
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
    return false;
  }

  const seg1Start = seg1[0];
  const seg1End = seg1[seg1.length - 1];
  const seg2Start = seg2[0];
  const seg2End = seg2[seg2.length - 1];

  const distStartStart = haversineDistance(
    seg1Start.pointA.lat,
    seg1Start.pointA.lng,
    seg2Start.pointA.lat,
    seg2Start.pointA.lng
  );
  const distEndEnd = haversineDistance(
    seg1End.pointA.lat,
    seg1End.pointA.lng,
    seg2End.pointA.lat,
    seg2End.pointA.lng
  );
  const distStartEnd = haversineDistance(
    seg1Start.pointA.lat,
    seg1Start.pointA.lng,
    seg2End.pointA.lat,
    seg2End.pointA.lng
  );
  const distEndStart = haversineDistance(
    seg1End.pointA.lat,
    seg1End.pointA.lng,
    seg2Start.pointA.lat,
    seg2Start.pointA.lng
  );

  const minDist = Math.min(
    distStartStart,
    distEndEnd,
    distStartEnd,
    distEndStart
  );
  return minDist <= MERGE_GAP_KM * 2;
}

/**
 * Merge two segment point arrays into one
 */
function mergeSegmentPoints(
  seg1: MatchingPoint[],
  seg2: MatchingPoint[]
): MatchingPoint[] {
  const pointMap = new Map<number, MatchingPoint>();

  for (const point of seg1) {
    pointMap.set(point.indexA, point);
  }
  for (const point of seg2) {
    if (!pointMap.has(point.indexA)) {
      pointMap.set(point.indexA, point);
    }
  }

  return Array.from(pointMap.values()).sort((a, b) => a.indexA - b.indexA);
}

/**
 * Advanced segment merging: merge overlapping and nearby segments
 */
function mergeOverlappingSegments(
  segments: MatchingPoint[][],
  algorithm: MatchingAlgorithm = 'standard'
): MatchingPoint[][] {
  if (segments.length <= 1) return segments;

  // In bidirectional mode, skip direction checks when merging
  const skipDirectionCheck = algorithm === 'bidirectional';

  const sorted = [...segments].sort((a, b) => {
    const aStart = Math.min(...a.map((p) => p.indexA));
    const bStart = Math.min(...b.map((p) => p.indexA));
    return aStart - bStart;
  });

  const result: MatchingPoint[][] = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    if (
      segmentsOverlap(current, next, skipDirectionCheck) ||
      segmentsAreSpatiallyClose(current, next, skipDirectionCheck)
    ) {
      current = mergeSegmentPoints(current, next);
    } else {
      if (current.length >= MIN_SEGMENT_POINTS) {
        result.push(current);
      }
      current = next;
    }
  }

  if (current.length >= MIN_SEGMENT_POINTS) {
    result.push(current);
  }

  return result;
}

/**
 * Create a MatchedSegment using actual track points for smoother path
 */
function createSegment(
  matchingPoints: MatchingPoint[],
  trackA: GpxTrack,
  trackB: GpxTrack
): MatchedSegment {
  // Sort matching points by indexA
  const sortedPoints = [...matchingPoints].sort((a, b) => a.indexA - b.indexA);

  // Get the full range of track A points for smoother path
  const startIdxA = sortedPoints[0].indexA;
  const endIdxA = sortedPoints[sortedPoints.length - 1].indexA;

  // Get track B indices
  const sortedByB = [...matchingPoints].sort((a, b) => a.indexB - b.indexB);
  const startIdxB = sortedByB[0].indexB;
  const endIdxB = sortedByB[sortedByB.length - 1].indexB;

  // Extract all track A points in the range
  const trackAPoints = trackA.elevation;
  const rawPoints: Array<{ lat: number; lng: number }> = [];

  for (let i = startIdxA; i <= endIdxA && i < trackAPoints.length; i++) {
    rawPoints.push({
      lat: trackAPoints[i].lat,
      lng: trackAPoints[i].lng,
    });
  }

  // Fallback to matching points if not enough
  if (rawPoints.length < 2) {
    for (const mp of sortedPoints) {
      rawPoints.push({ lat: mp.pointA.lat, lng: mp.pointA.lng });
    }
  }

  // Apply smoothing first, then simplify
  const smoothed = smoothPolyline(rawPoints, 5);
  const points = simplifyPolyline(smoothed);

  // Calculate segment distance
  let distance = 0;
  for (let i = 1; i < rawPoints.length; i++) {
    distance += haversineDistance(
      rawPoints[i - 1].lat,
      rawPoints[i - 1].lng,
      rawPoints[i].lat,
      rawPoints[i].lng
    );
  }

  // Calculate segment direction
  const { bearing, label } = calculateSegmentDirection(points);

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
  };
}

/**
 * Calculate adaptive sample rate based on track length
 * Shorter tracks get denser sampling, longer tracks get sparser
 */
function getAdaptiveSampleRate(trackLength: number): number {
  if (trackLength <= ADAPTIVE_TARGET_POINTS) {
    return ADAPTIVE_MIN_RATE; // Sample every point for short tracks
  }
  const rate = Math.ceil(trackLength / ADAPTIVE_TARGET_POINTS);
  return Math.min(rate, ADAPTIVE_MAX_RATE);
}

function findMatchesBetweenTracks(
  trackA: GpxTrack,
  trackB: GpxTrack,
  deltaMeters: number,
  algorithm: MatchingAlgorithm = 'standard'
): MatchedSegment[] {
  const pointsA = trackA.elevation;
  const pointsB = trackB.elevation;

  if (
    pointsA.length < MIN_SEGMENT_POINTS ||
    pointsB.length < MIN_SEGMENT_POINTS
  ) {
    return [];
  }

  const deltaKm = deltaMeters / 1000;
  const matchingPoints: MatchingPoint[] = [];

  const grid = getSpatialGrid(trackB.id, pointsB, Math.max(deltaKm * 2, 0.5));

  // Determine sample rate based on algorithm
  const sampleRate = algorithm === 'standard' 
    ? POINT_SAMPLE_RATE 
    : getAdaptiveSampleRate(pointsA.length);
  
  // Bidirectional mode skips bearing check entirely
  const checkBearing = algorithm !== 'bidirectional';

  for (let i = 0; i < pointsA.length; i += sampleRate) {
    const pointA = pointsA[i];

    const nearest = grid.findNearestWithinDistance(
      pointA.lat,
      pointA.lng,
      deltaKm
    );

    if (!nearest) continue;

    const pointB = pointsB[nearest.index];

    // Only check bearing if not in bidirectional mode
    if (checkBearing && i > 0 && nearest.index > 0) {
      const prevIdxA = Math.max(0, i - sampleRate);
      const prevIdxB = Math.max(0, nearest.index - sampleRate);

      const bearingA = calculateBearing(
        pointsA[prevIdxA].lat,
        pointsA[prevIdxA].lng,
        pointA.lat,
        pointA.lng
      );
      const bearingB = calculateBearing(
        pointsB[prevIdxB].lat,
        pointsB[prevIdxB].lng,
        pointB.lat,
        pointB.lng
      );

      if (!bearingsAreSimilar(bearingA, bearingB)) {
        continue;
      }
    }

    matchingPoints.push({
      pointA,
      pointB,
      indexA: i,
      indexB: nearest.index,
    });
  }

  return groupIntoSegments(matchingPoints, trackA, trackB, algorithm);
}

function findMatchingSegments(
  tracks: GpxTrack[],
  deltaMeters: number,
  algorithm: MatchingAlgorithm = 'standard'
): MatchedSegment[] {
  const visibleTracks = tracks.filter((t) => t.visible);

  if (visibleTracks.length < 2) return [];

  const allSegments: MatchedSegment[] = [];

  for (let i = 0; i < visibleTracks.length; i++) {
    for (let j = i + 1; j < visibleTracks.length; j++) {
      const segments = findMatchesBetweenTracks(
        visibleTracks[i],
        visibleTracks[j],
        deltaMeters,
        algorithm
      );
      allSegments.push(...segments);
    }
  }

  return allSegments.sort((a, b) => b.distance - a.distance);
}

// Worker message handler
self.onmessage = (e: MessageEvent<{ tracks: GpxTrack[]; delta: number; algorithm: MatchingAlgorithm }>) => {
  const { tracks, delta, algorithm } = e.data;
  const segments = findMatchingSegments(tracks, delta, algorithm);
  self.postMessage(segments);
};
