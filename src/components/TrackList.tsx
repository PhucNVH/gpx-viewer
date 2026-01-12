import { useTrackStore } from '../store/useTrackStore'
import { TrackItem } from './TrackItem'

export function TrackList() {
  const tracks = useTrackStore((state) => state.tracks)
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId)
  const clearAllTracks = useTrackStore((state) => state.clearAllTracks)

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="p-3 rounded-full bg-surface-800 mb-3">
          <svg className="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <p className="text-sm text-surface-400">No tracks loaded</p>
        <p className="text-xs text-surface-600 mt-1">Upload GPX files to get started</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
          Tracks ({tracks.length})
        </h3>
        <button
          onClick={clearAllTracks}
          className="text-xs text-surface-500 hover:text-red-400 transition-colors"
        >
          Clear all
        </button>
      </div>
      
      <div className="flex flex-col gap-1">
        {tracks.map((track) => (
          <TrackItem
            key={track.id}
            track={track}
            isSelected={track.id === selectedTrackId}
          />
        ))}
      </div>
    </div>
  )
}
