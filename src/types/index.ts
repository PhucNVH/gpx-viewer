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
}

export interface MatchingSettings {
  enabled: boolean
  delta: number // meters
}
