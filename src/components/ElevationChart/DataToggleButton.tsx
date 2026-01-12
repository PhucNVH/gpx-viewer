interface DataToggleButtonProps {
  isActive: boolean
  onClick: () => void
  title: string
  label: string
  color: 'red' | 'blue'
  icon: React.ReactNode
}

export function DataToggleButton({ isActive, onClick, title, label, color, icon }: DataToggleButtonProps) {
  const colorClasses = {
    red: isActive ? 'bg-red-500/20 text-red-400' : 'bg-surface-800 text-surface-500',
    blue: isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-surface-800 text-surface-500',
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${colorClasses[color]}`}
      title={title}
    >
      {icon}
      {label}
    </button>
  )
}

export function HeartRateIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  )
}

export function CadenceIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}
