import type { GpxTrack, MatchedSegment, MatchingAlgorithm } from '../types'

// Create worker using Vite's worker import syntax
let worker: Worker | null = null
let pendingCallback: ((segments: MatchedSegment[]) => void) | null = null

function getWorker(): Worker | null {
  if (worker) return worker
  
  // Only create worker in browser environment
  if (typeof window === 'undefined') return null
  
  try {
    worker = new Worker(
      new URL('../workers/segmentMatcher.worker.ts', import.meta.url),
      { type: 'module' }
    )
    
    worker.onmessage = (e: MessageEvent<MatchedSegment[]>) => {
      if (pendingCallback) {
        pendingCallback(e.data)
        pendingCallback = null
      }
    }
    
    worker.onerror = (err) => {
      console.error('Segment matcher worker error:', err)
      if (pendingCallback) {
        pendingCallback([])
        pendingCallback = null
      }
    }
    
    return worker
  } catch (err) {
    console.warn('Web Worker not supported, falling back to main thread:', err)
    return null
  }
}

export function calculateMatchingSegmentsAsync(
  tracks: GpxTrack[],
  delta: number,
  algorithm: MatchingAlgorithm,
  onComplete: (segments: MatchedSegment[]) => void
): void {
  const w = getWorker()
  
  if (!w) {
    // Fallback: import and run on main thread (will be lazy-loaded)
    import('../utils/segmentMatcher').then(({ findMatchingSegments }) => {
      // Use requestIdleCallback if available for fallback
      const calculate = () => {
        const segments = findMatchingSegments(tracks, delta, algorithm)
        onComplete(segments)
      }
      
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void })
          .requestIdleCallback(calculate, { timeout: 500 })
      } else {
        setTimeout(calculate, 0)
      }
    })
    return
  }
  
  // Set callback and post message to worker
  pendingCallback = onComplete
  
  // Only send necessary data to worker (avoid sending geojson which is large)
  const tracksForWorker = tracks.map(t => ({
    id: t.id,
    name: t.name,
    elevation: t.elevation,
    visible: t.visible,
    color: t.color,
    geojson: { type: 'FeatureCollection' as const, features: [] }, // Placeholder, not used in matching
  }))
  
  w.postMessage({ tracks: tracksForWorker, delta, algorithm })
}

export function terminateWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
    pendingCallback = null
  }
}

