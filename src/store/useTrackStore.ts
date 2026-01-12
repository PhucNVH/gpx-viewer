import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GpxTrack, HoveredPoint, SelectedPoint, SegmentStats, ElevationPoint, MatchingSettings, MatchedSegment } from '../types'
import { resetColorIndex, setColorIndex } from '../utils/colorGenerator'
import { findMatchingSegments } from '../utils/segmentMatcher'

// Segment data stored per track
interface TrackSegment {
  start: SelectedPoint | null
  end: SelectedPoint | null
}

interface TrackState {
  tracks: GpxTrack[]
  selectedTrackId: string | null
  hoveredPoint: HoveredPoint | null
  // Segment selection - stored per track ID
  selectionMode: boolean
  trackSegments: Record<string, TrackSegment>
  // Matching settings
  matchingSettings: MatchingSettings
  // Actions
  addTracks: (tracks: GpxTrack[]) => void
  removeTrack: (id: string) => void
  toggleVisibility: (id: string) => void
  selectTrack: (id: string | null) => void
  setHoveredPoint: (point: HoveredPoint | null) => void
  toggleSelectionMode: () => void
  setSegmentPoint: (point: SelectedPoint) => void
  clearSegment: (trackId?: string) => void
  clearAllTracks: () => void
  setMatchingEnabled: (enabled: boolean) => void
  setMatchingDelta: (delta: number) => void
}

export const useTrackStore = create<TrackState>()(
  persist(
    (set, get) => ({
  tracks: [],
  selectedTrackId: null,
  hoveredPoint: null,
  selectionMode: false,
  trackSegments: {},
  matchingSettings: {
    enabled: false,
    delta: 300, // Default 30 meters
  },
  
  addTracks: (newTracks) => {
    set((state) => {
      const updatedTracks = [...state.tracks, ...newTracks]
      // Auto-select first track if none selected
      const selectedTrackId = state.selectedTrackId ?? newTracks[0]?.id ?? null
      return { tracks: updatedTracks, selectedTrackId }
    })
  },
  
  removeTrack: (id) => {
    set((state) => {
      const tracks = state.tracks.filter((t) => t.id !== id)
      const selectedTrackId = state.selectedTrackId === id 
        ? (tracks[0]?.id ?? null) 
        : state.selectedTrackId
      // Remove segment data for this track
      const { [id]: _, ...remainingSegments } = state.trackSegments
      return { tracks, selectedTrackId, trackSegments: remainingSegments }
    })
  },
  
  toggleVisibility: (id) => {
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === id ? { ...t, visible: !t.visible } : t
      ),
    }))
  },
  
  selectTrack: (id) => {
    // Don't clear segments - they're stored per track now
    set({ 
      selectedTrackId: id, 
      hoveredPoint: null,
    })
  },
  
  setHoveredPoint: (point) => {
    set({ hoveredPoint: point })
  },
  
  toggleSelectionMode: () => {
    const { selectionMode } = get()
    set({ selectionMode: !selectionMode })
  },
  
  setSegmentPoint: (point) => {
    const { selectedTrackId, trackSegments } = get()
    if (!selectedTrackId) return
    
    const currentSegment = trackSegments[selectedTrackId] || { start: null, end: null }
    
    let newSegment: TrackSegment
    
    if (!currentSegment.start) {
      // Set as start point
      newSegment = { start: point, end: null }
    } else if (!currentSegment.end) {
      // Set as end point, ensuring start < end
      if (point.index < currentSegment.start.index) {
        newSegment = { start: point, end: currentSegment.start }
      } else {
        newSegment = { start: currentSegment.start, end: point }
      }
    } else {
      // Both set, start new selection
      newSegment = { start: point, end: null }
    }
    
    set({
      trackSegments: {
        ...trackSegments,
        [selectedTrackId]: newSegment,
      },
    })
  },
  
  clearSegment: (trackId?: string) => {
    const { selectedTrackId, trackSegments } = get()
    const idToClear = trackId || selectedTrackId
    if (!idToClear) return
    
    set({
      trackSegments: {
        ...trackSegments,
        [idToClear]: { start: null, end: null },
      },
    })
  },
  
  clearAllTracks: () => {
    resetColorIndex()
    set({ 
      tracks: [], 
      selectedTrackId: null, 
      hoveredPoint: null,
      selectionMode: false,
      trackSegments: {},
      matchingSettings: { enabled: false, delta: 30 },
    })
  },
  
  setMatchingEnabled: (enabled) => {
    set((state) => ({
      matchingSettings: { ...state.matchingSettings, enabled },
    }))
  },
  
  setMatchingDelta: (delta) => {
    set((state) => ({
      matchingSettings: { ...state.matchingSettings, delta },
    }))
  },
    }),
    {
      name: 'gpx-tracks-storage',
      // Only persist essential data, not UI state like hoveredPoint
      partialize: (state) => ({
        tracks: state.tracks,
        selectedTrackId: state.selectedTrackId,
        trackSegments: state.trackSegments,
        matchingSettings: state.matchingSettings,
      }),
      // Restore color index based on loaded tracks
      onRehydrateStorage: () => (state) => {
        if (state?.tracks.length) {
          setColorIndex(state.tracks.length)
        }
      },
    }
  )
)

// Selector for the currently selected track
export const useSelectedTrack = () => {
  const tracks = useTrackStore((state) => state.tracks)
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId)
  return tracks.find((t) => t.id === selectedTrackId) ?? null
}

// Selector for visible tracks only
export const useVisibleTracks = () => {
  return useTrackStore((state) => state.tracks.filter((t) => t.visible))
}

// Selector for current track's segment
export const useCurrentSegment = () => {
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId)
  const trackSegments = useTrackStore((state) => state.trackSegments)
  if (!selectedTrackId) return { start: null, end: null }
  return trackSegments[selectedTrackId] || { start: null, end: null }
}

// Selector for matching settings
export const useMatchingSettings = () => {
  return useTrackStore((state) => state.matchingSettings)
}

// Selector for matched segments - computes when enabled
export const useMatchedSegments = (): MatchedSegment[] => {
  const tracks = useTrackStore((state) => state.tracks)
  const matchingSettings = useTrackStore((state) => state.matchingSettings)
  
  if (!matchingSettings.enabled) return []
  
  const visibleTracks = tracks.filter(t => t.visible)
  if (visibleTracks.length < 2) return []
  
  return findMatchingSegments(tracks, matchingSettings.delta)
}

// Calculate segment statistics
export function calculateSegmentStats(
  elevation: ElevationPoint[],
  startIndex: number,
  endIndex: number
): SegmentStats {
  const start = Math.min(startIndex, endIndex)
  const end = Math.max(startIndex, endIndex)
  
  const segmentPoints = elevation.slice(start, end + 1)
  
  if (segmentPoints.length < 2) {
    return {
      distance: 0,
      elevationGain: 0,
      elevationLoss: 0,
      netElevation: 0,
      avgSlope: 0,
      maxSlope: 0,
    }
  }
  
  const distance = segmentPoints[segmentPoints.length - 1].distance - segmentPoints[0].distance
  const netElevation = segmentPoints[segmentPoints.length - 1].elevation - segmentPoints[0].elevation
  
  let elevationGain = 0
  let elevationLoss = 0
  let maxSlope = 0
  
  for (let i = 1; i < segmentPoints.length; i++) {
    const elevDiff = segmentPoints[i].elevation - segmentPoints[i - 1].elevation
    const distDiff = (segmentPoints[i].distance - segmentPoints[i - 1].distance) * 1000 // convert to meters
    
    if (elevDiff > 0) {
      elevationGain += elevDiff
    } else {
      elevationLoss += Math.abs(elevDiff)
    }
    
    // Calculate slope for this segment
    if (distDiff > 0) {
      const slope = Math.abs((elevDiff / distDiff) * 100)
      maxSlope = Math.max(maxSlope, slope)
    }
  }
  
  // Average slope (net elevation / horizontal distance)
  const avgSlope = distance > 0 ? (netElevation / (distance * 1000)) * 100 : 0
  
  return {
    distance,
    elevationGain,
    elevationLoss,
    netElevation,
    avgSlope,
    maxSlope,
  }
}
