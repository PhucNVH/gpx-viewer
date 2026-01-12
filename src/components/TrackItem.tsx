import type { GpxTrack } from '../types'
import { useTrackStore } from '../store/useTrackStore'
import { calculateElevationGain } from '../utils/elevation'

interface TrackItemProps {
  track: GpxTrack
  isSelected: boolean
}

export function TrackItem({ track, isSelected }: TrackItemProps) {
  const selectTrack = useTrackStore((state) => state.selectTrack)
  const toggleVisibility = useTrackStore((state) => state.toggleVisibility)
  const removeTrack = useTrackStore((state) => state.removeTrack)

  const totalDistance = track.elevation.length > 0 
    ? track.elevation[track.elevation.length - 1].distance 
    : 0

  const elevationGain = calculateElevationGain(track.elevation)

  return (
    <div
      onClick={() => selectTrack(track.id)}
      className={`
        group relative p-3 rounded-lg cursor-pointer
        transition-all duration-150 ease-out
        ${isSelected 
          ? 'bg-surface-800 ring-1 ring-accent-500/50' 
          : 'hover:bg-surface-800/50'
        }
      `}
    >
      <div className="flex items-start gap-3">
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0 ring-2 ring-white/10"
          style={{ backgroundColor: track.color }}
        />
        
        <div className="flex-1 min-w-0">
          {/* Track name */}
          <p className="text-sm font-medium text-surface-100 truncate">
            {track.name}
          </p>
          
          {/* Stats */}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-surface-400">
              {totalDistance.toFixed(1)} km
            </span>
            <span className="text-xs text-surface-500">•</span>
            <span className="text-xs text-surface-400">
              ↑ {elevationGain.toFixed(0)} m
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Visibility toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleVisibility(track.id)
            }}
            className={`
              p-1.5 rounded-md transition-colors
              ${track.visible 
                ? 'text-surface-300 hover:text-surface-100 hover:bg-surface-700' 
                : 'text-surface-600 hover:text-surface-400 hover:bg-surface-700'
              }
            `}
            title={track.visible ? 'Hide track' : 'Show track'}
          >
            {track.visible ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>

          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeTrack(track.id)
            }}
            className="p-1.5 rounded-md text-surface-500 hover:text-red-400 hover:bg-surface-700 transition-colors"
            title="Remove track"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
