interface EmptyStateProps {
  type: 'no-track' | 'no-data'
  isMaximized?: boolean
}

export function EmptyState({ type, isMaximized = false }: EmptyStateProps) {
  if (type === 'no-track') {
    return (
      <div className={`flex flex-col items-center justify-center text-center py-8 ${isMaximized ? 'h-full' : ''}`}>
        <div className="p-3 rounded-full bg-surface-800 mb-3">
          <svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <p className="text-sm text-surface-400">Select a track</p>
        <p className="text-xs text-surface-600 mt-1">to view elevation profile</p>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center text-center py-8 ${isMaximized ? 'h-full' : ''}`}>
      <p className="text-sm text-surface-400">No elevation data</p>
      <p className="text-xs text-surface-600 mt-1">This track has no elevation information</p>
    </div>
  )
}
