interface SelectionHintProps {
  hasStart: boolean
  hasEnd: boolean
}

export function SelectionHint({ hasStart, hasEnd }: SelectionHintProps) {
  if (hasEnd) return null

  const message = !hasStart 
    ? 'Click on chart to select start point'
    : 'Click on chart to select end point'

  return (
    <p className="text-xs text-center text-accent-400/80 animate-pulse">
      {message}
    </p>
  )
}
