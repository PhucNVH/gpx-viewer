import { create } from "zustand";
import {
  persist,
  createJSONStorage,
  type StateStorage,
} from "zustand/middleware";
import type {
  GpxTrack,
  HoveredPoint,
  SelectedPoint,
  SegmentStats,
  ElevationPoint,
  MatchingSettings,
  MatchedSegment,
} from "../types";
import { resetColorIndex, setColorIndex } from "../utils/colorGenerator";
import { calculateMatchingSegmentsAsync } from "../hooks/useSegmentMatcherWorker";

// Segment data stored per track
interface TrackSegment {
  start: SelectedPoint | null;
  end: SelectedPoint | null;
}

// Debounce timer for matching recalculation
let matchingDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const MATCHING_DEBOUNCE_MS = 150; // Wait 150ms after last change before recalculating

// Custom storage that handles quota errors gracefully
const safeLocalStorage: StateStorage = {
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name);
    } catch (e) {
      console.warn("Failed to read from localStorage:", e);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      localStorage.setItem(name, value);
    } catch (e) {
      // Quota exceeded or other storage error
      console.warn(
        "Failed to save to localStorage (quota may be exceeded):",
        e
      );
      // Try to clear old data and retry once
      try {
        localStorage.removeItem(name);
        localStorage.setItem(name, value);
      } catch {
        // Give up silently - data won't be persisted
        console.warn("Storage quota exceeded. Track data will not be saved.");
      }
    }
  },
  removeItem: (name: string): void => {
    try {
      localStorage.removeItem(name);
    } catch (e) {
      console.warn("Failed to remove from localStorage:", e);
    }
  },
};

interface TrackState {
  tracks: GpxTrack[];
  selectedTrackId: string | null;
  hoveredPoint: HoveredPoint | null;
  // Segment selection - stored per track ID
  selectionMode: boolean;
  trackSegments: Record<string, TrackSegment>;
  // Matching settings and cached results
  matchingSettings: MatchingSettings;
  matchedSegments: MatchedSegment[];
  isMatchingLoading: boolean;
  // Highlighted segment from sidebar (hovered or selected)
  highlightedSegmentId: string | null;
  selectedMatchedSegmentId: string | null;
  // Actions
  addTracks: (tracks: GpxTrack[]) => void;
  removeTrack: (id: string) => void;
  toggleVisibility: (id: string) => void;
  selectTrack: (id: string | null) => void;
  setHoveredPoint: (point: HoveredPoint | null) => void;
  toggleSelectionMode: () => void;
  setSegmentPoint: (point: SelectedPoint) => void;
  clearSegment: (trackId?: string) => void;
  clearAllTracks: () => void;
  setHighlightedSegment: (id: string | null) => void;
  setSelectedMatchedSegment: (id: string | null) => void;
  setMatchingEnabled: (enabled: boolean) => void;
  setMatchingDelta: (delta: number) => void;
  recalculateMatching: () => void;
}

// Helper function to trigger debounced matching recalculation
function scheduleMatchingRecalculation(
  get: () => TrackState,
  set: (state: Partial<TrackState>) => void
) {
  const { matchingSettings } = get();
  if (!matchingSettings.enabled) return;

  // Clear any pending recalculation
  if (matchingDebounceTimer) {
    clearTimeout(matchingDebounceTimer);
  }

  // Set loading state immediately for UI feedback
  set({ isMatchingLoading: true });

  // Schedule the actual recalculation with debounce
  matchingDebounceTimer = setTimeout(() => {
    const state = get();
    const visibleTracks = state.tracks.filter((t) => t.visible);

    if (visibleTracks.length < 2 || !state.matchingSettings.enabled) {
      set({ matchedSegments: [], isMatchingLoading: false });
      return;
    }

    // Use Web Worker for off-main-thread calculation
    calculateMatchingSegmentsAsync(
      state.tracks,
      state.matchingSettings.delta,
      (segments) => {
        // Only update if matching is still enabled
        if (get().matchingSettings.enabled) {
          set({ matchedSegments: segments, isMatchingLoading: false });
        }
      }
    );
  }, MATCHING_DEBOUNCE_MS);
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
        delta: 300, // Default 300 meters
      },
      matchedSegments: [],
      isMatchingLoading: false,
      highlightedSegmentId: null,
      selectedMatchedSegmentId: null,

      addTracks: (newTracks) => {
        set((state) => {
          const updatedTracks = [...state.tracks, ...newTracks];
          // Auto-select first track if none selected
          const selectedTrackId =
            state.selectedTrackId ?? newTracks[0]?.id ?? null;
          return { tracks: updatedTracks, selectedTrackId };
        });
        // Recalculate matching if enabled
        scheduleMatchingRecalculation(get, set);
      },

      removeTrack: (id) => {
        set((state) => {
          const tracks = state.tracks.filter((t) => t.id !== id);
          const selectedTrackId =
            state.selectedTrackId === id
              ? tracks[0]?.id ?? null
              : state.selectedTrackId;
          // Remove segment data for this track
          const { [id]: _, ...remainingSegments } = state.trackSegments;
          return { tracks, selectedTrackId, trackSegments: remainingSegments };
        });
        // Recalculate matching if enabled
        scheduleMatchingRecalculation(get, set);
      },

      toggleVisibility: (id) => {
        set((state) => ({
          tracks: state.tracks.map((t) =>
            t.id === id ? { ...t, visible: !t.visible } : t
          ),
        }));
        // Recalculate matching if enabled
        scheduleMatchingRecalculation(get, set);
      },

      selectTrack: (id) => {
        // Don't clear segments - they're stored per track now
        set({
          selectedTrackId: id,
          hoveredPoint: null,
        });
      },

      setHoveredPoint: (point) => {
        set({ hoveredPoint: point });
      },

      toggleSelectionMode: () => {
        const { selectionMode } = get();
        set({ selectionMode: !selectionMode });
      },

      setSegmentPoint: (point) => {
        const { selectedTrackId, trackSegments } = get();
        if (!selectedTrackId) return;

        const currentSegment = trackSegments[selectedTrackId] || {
          start: null,
          end: null,
        };

        let newSegment: TrackSegment;

        if (!currentSegment.start) {
          // Set as start point
          newSegment = { start: point, end: null };
        } else if (!currentSegment.end) {
          // Set as end point, ensuring start < end
          if (point.index < currentSegment.start.index) {
            newSegment = { start: point, end: currentSegment.start };
          } else {
            newSegment = { start: currentSegment.start, end: point };
          }
        } else {
          // Both set, start new selection
          newSegment = { start: point, end: null };
        }

        set({
          trackSegments: {
            ...trackSegments,
            [selectedTrackId]: newSegment,
          },
        });
      },

      clearSegment: (trackId?: string) => {
        const { selectedTrackId, trackSegments } = get();
        const idToClear = trackId || selectedTrackId;
        if (!idToClear) return;

        set({
          trackSegments: {
            ...trackSegments,
            [idToClear]: { start: null, end: null },
          },
        });
      },

      clearAllTracks: () => {
        resetColorIndex();
        // Clear any pending matching calculation
        if (matchingDebounceTimer) {
          clearTimeout(matchingDebounceTimer);
          matchingDebounceTimer = null;
        }
        set({
          tracks: [],
          selectedTrackId: null,
          hoveredPoint: null,
          selectionMode: false,
          trackSegments: {},
          matchingSettings: { enabled: false, delta: 300 },
          matchedSegments: [],
          isMatchingLoading: false,
          highlightedSegmentId: null,
          selectedMatchedSegmentId: null,
        });
      },

      setMatchingEnabled: (enabled) => {
        set((state) => ({
          matchingSettings: { ...state.matchingSettings, enabled },
        }));
        if (enabled) {
          // Recalculate immediately when enabled
          scheduleMatchingRecalculation(get, set);
        } else {
          // Clear segments when disabled
          if (matchingDebounceTimer) {
            clearTimeout(matchingDebounceTimer);
            matchingDebounceTimer = null;
          }
          set({ matchedSegments: [], isMatchingLoading: false });
        }
      },

      setMatchingDelta: (delta) => {
        set((state) => ({
          matchingSettings: { ...state.matchingSettings, delta },
        }));
        // Debounced recalculation when delta changes
        scheduleMatchingRecalculation(get, set);
      },

      recalculateMatching: () => {
        scheduleMatchingRecalculation(get, set);
      },

      setHighlightedSegment: (id) => {
        set({ highlightedSegmentId: id });
      },

      setSelectedMatchedSegment: (id) => {
        // Toggle selection if clicking the same segment
        const currentSelected = get().selectedMatchedSegmentId;
        set({ selectedMatchedSegmentId: currentSelected === id ? null : id });
      },
    }),
    {
      name: "gpx-tracks-storage",
      storage: createJSONStorage(() => safeLocalStorage),
      // Only persist essential data, not UI state or computed values
      // Note: matchingSettings.enabled not persisted - matching starts disabled on reload
      // This prevents localStorage quota issues with large track data
      partialize: (state) => ({
        tracks: state.tracks,
        selectedTrackId: state.selectedTrackId,
        trackSegments: state.trackSegments,
        // Only persist delta, not enabled state (matching always starts off)
        matchingDelta: state.matchingSettings.delta,
      }),
      // Restore color index based on loaded tracks
      onRehydrateStorage: () => (state, error) => {
        if (error) return;
        if (state?.tracks.length) {
          setColorIndex(state.tracks.length);
        }
      },
      // Merge persisted state with defaults
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<TrackState> & {
          matchingDelta?: number;
        };
        return {
          ...currentState,
          tracks: persisted.tracks ?? currentState.tracks,
          selectedTrackId:
            persisted.selectedTrackId ?? currentState.selectedTrackId,
          trackSegments: persisted.trackSegments ?? currentState.trackSegments,
          matchingSettings: {
            enabled: false, // Always start with matching disabled
            delta:
              persisted.matchingDelta ?? currentState.matchingSettings.delta,
          },
        };
      },
    }
  )
);

// Selector for the currently selected track
export const useSelectedTrack = () => {
  const tracks = useTrackStore((state) => state.tracks);
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  return tracks.find((t) => t.id === selectedTrackId) ?? null;
};

// Selector for visible tracks only
export const useVisibleTracks = () => {
  return useTrackStore((state) => state.tracks.filter((t) => t.visible));
};

// Selector for current track's segment
export const useCurrentSegment = () => {
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId);
  const trackSegments = useTrackStore((state) => state.trackSegments);
  if (!selectedTrackId) return { start: null, end: null };
  return trackSegments[selectedTrackId] || { start: null, end: null };
};

// Selector for matching settings
export const useMatchingSettings = () => {
  return useTrackStore((state) => state.matchingSettings);
};

// Selector for matched segments - returns cached value from state
export const useMatchedSegments = (): MatchedSegment[] => {
  return useTrackStore((state) => state.matchedSegments);
};

// Selector for matching loading state
export const useMatchingLoading = (): boolean => {
  return useTrackStore((state) => state.isMatchingLoading);
};

// Selector for highlighted segment (hovered from sidebar)
export const useHighlightedSegmentId = (): string | null => {
  return useTrackStore((state) => state.highlightedSegmentId);
};

// Selector for selected matched segment (clicked from sidebar)
export const useSelectedMatchedSegmentId = (): string | null => {
  return useTrackStore((state) => state.selectedMatchedSegmentId);
};

// Selector for selected matched segment with full elevation data
export interface MatchedSegmentElevationData {
  segment: MatchedSegment
  trackAElevation: ElevationPoint[]
  trackBElevation: ElevationPoint[]
  trackAColor: string
  trackBColor: string
}

export const useSelectedMatchedSegmentData = (): MatchedSegmentElevationData | null => {
  const tracks = useTrackStore((state) => state.tracks)
  const matchedSegments = useTrackStore((state) => state.matchedSegments)
  const selectedId = useTrackStore((state) => state.selectedMatchedSegmentId)

  if (!selectedId) return null

  const segment = matchedSegments.find((s) => s.id === selectedId)
  if (!segment) return null

  const trackA = tracks.find((t) => t.id === segment.trackAId)
  const trackB = tracks.find((t) => t.id === segment.trackBId)

  if (!trackA || !trackB) return null

  // Extract elevation data for the segment range
  const trackAElevation = trackA.elevation.slice(
    segment.startIndexA,
    segment.endIndexA + 1
  )
  const trackBElevation = trackB.elevation.slice(
    segment.startIndexB,
    segment.endIndexB + 1
  )

  return {
    segment,
    trackAElevation,
    trackBElevation,
    trackAColor: trackA.color,
    trackBColor: trackB.color,
  }
}

// Calculate segment statistics
export function calculateSegmentStats(
  elevation: ElevationPoint[],
  startIndex: number,
  endIndex: number
): SegmentStats {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);

  const segmentPoints = elevation.slice(start, end + 1);

  if (segmentPoints.length < 2) {
    return {
      distance: 0,
      elevationGain: 0,
      elevationLoss: 0,
      netElevation: 0,
      avgSlope: 0,
      maxSlope: 0,
    };
  }

  const distance =
    segmentPoints[segmentPoints.length - 1].distance -
    segmentPoints[0].distance;
  const netElevation =
    segmentPoints[segmentPoints.length - 1].elevation -
    segmentPoints[0].elevation;

  let elevationGain = 0;
  let elevationLoss = 0;
  let maxSlope = 0;

  for (let i = 1; i < segmentPoints.length; i++) {
    const elevDiff =
      segmentPoints[i].elevation - segmentPoints[i - 1].elevation;
    const distDiff =
      (segmentPoints[i].distance - segmentPoints[i - 1].distance) * 1000; // convert to meters

    if (elevDiff > 0) {
      elevationGain += elevDiff;
    } else {
      elevationLoss += Math.abs(elevDiff);
    }

    // Calculate slope for this segment
    if (distDiff > 0) {
      const slope = Math.abs((elevDiff / distDiff) * 100);
      maxSlope = Math.max(maxSlope, slope);
    }
  }

  // Average slope (net elevation / horizontal distance)
  const avgSlope = distance > 0 ? (netElevation / (distance * 1000)) * 100 : 0;

  return {
    distance,
    elevationGain,
    elevationLoss,
    netElevation,
    avgSlope,
    maxSlope,
  };
}
