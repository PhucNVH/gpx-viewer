import type { FeatureCollection } from 'geojson'

export interface ElevationPoint {
  distance: number // km
  elevation: number // m
  lat: number
  lng: number
  heartRate?: number // bpm
  cadence?: number // rpm or spm
}

export interface GpxTrack {
  id: string
  name: string
  geojson: FeatureCollection
  elevation: ElevationPoint[]
  visible: boolean
  color: string
  /** UUID for retrieving the GPX file from MinIO storage */
  storageId: string
}

/**
 * Minimal track metadata stored in localStorage
 * The actual GPX data is retrieved from MinIO using storageId
 */
export interface StoredTrackMeta {
  id: string
  name: string
  storageId: string
  visible: boolean
  color: string
}

export interface HoveredPoint {
  lat: number
  lng: number
  distance: number
  elevation: number
  heartRate?: number
  cadence?: number
}

export interface SelectedPoint {
  lat: number
  lng: number
  distance: number
  elevation: number
  index: number
}

export interface SegmentStats {
  distance: number // km
  elevationGain: number // m
  elevationLoss: number // m
  netElevation: number // m
  avgSlope: number // percent
  maxSlope: number // percent
}

export interface MatchedSegment {
  id: string
  trackAId: string
  trackBId: string
  trackAName: string
  trackBName: string
  points: Array<{ lat: number; lng: number }>
  distance: number // km
  direction: number // bearing in degrees (0-360, 0 = North, 90 = East)
  directionLabel: string // e.g., "N", "NE", "E", etc.
  // Track indices for elevation chart display
  startIndexA: number
  endIndexA: number
  startIndexB: number
  endIndexB: number
}

export interface MatchingSettings {
  enabled: boolean
  delta: number // meters
}
