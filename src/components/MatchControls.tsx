import type { MatchingAlgorithm } from '../types'
import { useTrackStore, useMatchingSettings, useVisibleTracks, useMatchingLoading } from '../store/useTrackStore'

const ALGORITHM_OPTIONS: { value: MatchingAlgorithm; label: string; description: string }[] = [
  { 
    value: 'standard', 
    label: 'Standard', 
    description: 'Fixed sampling, direction-aware matching'
  },
  { 
    value: 'adaptive', 
    label: 'Adaptive', 
    description: 'Smart sampling for better short segment detection'
  },
  { 
    value: 'bidirectional', 
    label: 'Bidirectional', 
    description: 'Matches any direction (e.g., uphill vs downhill)'
  },
]

export function MatchControls() {
  const visibleTracks = useVisibleTracks()
  const matchingSettings = useMatchingSettings()
  const isLoading = useMatchingLoading()
  const setMatchingEnabled = useTrackStore((state) => state.setMatchingEnabled)
  const setMatchingDelta = useTrackStore((state) => state.setMatchingDelta)
  const setMatchingAlgorithm = useTrackStore((state) => state.setMatchingAlgorithm)
  
  // Only show when 2+ tracks are visible
  if (visibleTracks.length < 2) {
    return null
  }

  const currentAlgo = ALGORITHM_OPTIONS.find(a => a.value === matchingSettings.algorithm)
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-surface-300">Segment Matching</h3>
          {isLoading && matchingSettings.enabled && (
            <div className="w-3 h-3 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={matchingSettings.enabled}
            onChange={(e) => setMatchingEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-surface-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-500/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-surface-400 after:border-surface-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-600 peer-checked:after:bg-white"></div>
        </label>
      </div>
      
      {matchingSettings.enabled && (
        <div className="space-y-4">
          {/* Algorithm selector */}
          <div className="space-y-2">
            <label className="text-xs text-surface-400">Algorithm</label>
            <select
              value={matchingSettings.algorithm}
              onChange={(e) => setMatchingAlgorithm(e.target.value as MatchingAlgorithm)}
              className="w-full px-3 py-1.5 text-sm bg-surface-800 border border-surface-600 rounded-md text-surface-200 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 appearance-none cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.5rem center',
                paddingRight: '2rem'
              }}
            >
              {ALGORITHM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {currentAlgo && (
              <p className="text-[10px] text-surface-500 leading-tight">
                {currentAlgo.description}
              </p>
            )}
          </div>

          {/* Distance threshold slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-400">Distance threshold</span>
              <span className="text-surface-300 font-mono">{matchingSettings.delta}m</span>
            </div>
            <input
              type="range"
              min="50"
              max="500"
              step="10"
              value={matchingSettings.delta}
              onChange={(e) => setMatchingDelta(Number(e.target.value))}
              className="w-full h-1.5 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
            />
            <div className="flex justify-between text-[10px] text-surface-500">
              <span>50m</span>
              <span>500m</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
