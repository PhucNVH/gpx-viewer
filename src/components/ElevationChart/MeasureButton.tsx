interface MeasureButtonProps {
  isSelecting: boolean
  onClick: () => void
}

export function MeasureButton({ isSelecting, onClick }: MeasureButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
        transition-all duration-150
        ${isSelecting 
          ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/50' 
          : 'bg-surface-800 text-surface-400 hover:text-surface-200 hover:bg-surface-700'
        }
      `}
      title="Click on chart to select two points and measure distance/elevation"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M3 6v12a2 2 0 002 2h14a2 2 0 002-2V6M3 6l3-3m0 0h3M6 3v3m12 0l3-3m0 0h-3m3 0v3M9 12h.01M15 12h.01M12 12h.01M9 16h.01M15 16h.01M12 16h.01" />
      </svg>
      {isSelecting ? 'Selecting...' : 'Measure'}
    </button>
  )
}
