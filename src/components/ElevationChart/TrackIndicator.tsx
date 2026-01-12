interface TrackIndicatorProps {
  name: string
  color: string
}

export function TrackIndicator({ name, color }: TrackIndicatorProps) {
  return (
    <div
      className="flex items-center gap-2 px-1"
      style={{ color }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs truncate max-w-[200px]">{name}</span>
    </div>
  )
}
