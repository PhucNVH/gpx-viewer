import { useMemo, useState } from 'react'
import { 
  useMatchedSegments, 
  useMatchingSettings, 
  useMatchingLoading,
  useTrackStore,
  useHighlightedSegmentId,
  useSelectedMatchedSegmentId,
} from '../store/useTrackStore'
import type { MatchedSegment } from '../types'

interface MatchPairGroup {
  trackAId: string
  trackBId: string
  trackAName: string
  trackBName: string
  segments: MatchedSegment[]
  totalDistance: number
}

// Direction arrow SVG component
function DirectionArrow({ direction, isActive }: { direction: number; isActive: boolean }) {
  return (
    <div 
      className={`w-4 h-4 flex items-center justify-center ${isActive ? 'text-cyan-400' : 'text-surface-500'}`}
      style={{ transform: `rotate(${direction}deg)` }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L4 14h5v8h6v-8h5L12 2z"/>
      </svg>
    </div>
  )
}

function SegmentItem({ 
  segment, 
  index,
  isHighlighted,
  isSelected,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: { 
  segment: MatchedSegment
  index: number
  isHighlighted: boolean
  isSelected: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}) {
  const distanceStr = segment.distance >= 1 
    ? `${segment.distance.toFixed(2)} km`
    : `${(segment.distance * 1000).toFixed(0)} m`

  const isActive = isSelected || isHighlighted

  return (
    <button
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      className={`
        w-full flex items-center justify-between py-1.5 px-2 rounded text-xs transition-all
        ${isSelected 
          ? 'bg-cyan-500/20 border border-cyan-500/50' 
          : isHighlighted 
            ? 'bg-surface-700/50 border border-surface-600' 
            : 'bg-surface-800/30 border border-transparent hover:bg-surface-700/30'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <div className={`
          w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium
          ${isActive ? 'bg-cyan-500 text-white' : 'bg-surface-700 text-surface-400'}
        `}>
          {index + 1}
        </div>
        {/* Direction indicator */}
        <DirectionArrow direction={segment.direction} isActive={isActive} />
        <span className={`${isActive ? 'text-cyan-300' : 'text-surface-400'}`}>
          {segment.directionLabel}
        </span>
      </div>
      <span className={`font-mono ${isActive ? 'text-cyan-400' : 'text-surface-500'}`}>
        {distanceStr}
      </span>
    </button>
  )
}

function PairGroup({ 
  group,
  highlightedId,
  selectedId,
  onHover,
  onLeave,
  onClick,
}: { 
  group: MatchPairGroup
  highlightedId: string | null
  selectedId: string | null
  onHover: (id: string) => void
  onLeave: () => void
  onClick: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const totalDistanceStr = group.totalDistance >= 1 
    ? `${group.totalDistance.toFixed(2)} km`
    : `${(group.totalDistance * 1000).toFixed(0)} m`

  return (
    <div className="bg-surface-900/50 rounded-md overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between py-2 px-2.5 hover:bg-surface-700/30 transition-colors"
      >
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <span className="text-surface-300 truncate max-w-[70px]" title={group.trackAName}>
            {group.trackAName}
          </span>
          <svg className="w-3 h-3 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span className="text-surface-300 truncate max-w-[70px]" title={group.trackBName}>
            {group.trackBName}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <span className="text-[10px] text-surface-500">
            {group.segments.length}
          </span>
          <span className="text-xs text-cyan-400 font-mono">
            {totalDistanceStr}
          </span>
          <svg 
            className={`w-3 h-3 text-surface-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {/* Segments List */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-1">
          {group.segments.map((segment, idx) => (
            <SegmentItem
              key={segment.id}
              segment={segment}
              index={idx}
              isHighlighted={highlightedId === segment.id}
              isSelected={selectedId === segment.id}
              onMouseEnter={() => onHover(segment.id)}
              onMouseLeave={onLeave}
              onClick={() => onClick(segment.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function MatchSummary() {
  const matchingSettings = useMatchingSettings()
  const matchedSegments = useMatchedSegments()
  const isLoading = useMatchingLoading()
  const highlightedId = useHighlightedSegmentId()
  const selectedId = useSelectedMatchedSegmentId()
  const setHighlightedSegment = useTrackStore((state) => state.setHighlightedSegment)
  const setSelectedMatchedSegment = useTrackStore((state) => state.setSelectedMatchedSegment)
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Group segments by track pairs
  const pairGroups = useMemo((): MatchPairGroup[] => {
    const pairMap = new Map<string, MatchPairGroup>()
    
    for (const segment of matchedSegments) {
      const pairKey = `${segment.trackAId}-${segment.trackBId}`
      
      if (pairMap.has(pairKey)) {
        const existing = pairMap.get(pairKey)!
        existing.segments.push(segment)
        existing.totalDistance += segment.distance
      } else {
        pairMap.set(pairKey, {
          trackAId: segment.trackAId,
          trackBId: segment.trackBId,
          trackAName: segment.trackAName,
          trackBName: segment.trackBName,
          segments: [segment],
          totalDistance: segment.distance,
        })
      }
    }
    
    return Array.from(pairMap.values())
  }, [matchedSegments])
  
  if (!matchingSettings.enabled) {
    return null
  }
  
  // Show loading state
  if (isLoading && matchedSegments.length === 0) {
    return (
      <div className="bg-surface-800/50 rounded-lg border border-surface-700/50 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-surface-400">Finding matching segments...</span>
        </div>
      </div>
    )
  }
  
  if (matchedSegments.length === 0) {
    return (
      <div className="bg-surface-800/50 rounded-lg border border-surface-700/50 px-3 py-2">
        <span className="text-sm text-surface-500">No matching segments found</span>
      </div>
    )
  }
  
  const totalMatchedDistance = pairGroups.reduce((sum, p) => sum + p.totalDistance, 0)
  
  return (
    <div className="bg-surface-800/50 rounded-lg border border-surface-700/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-sm font-medium text-surface-200">
            {matchedSegments.length} Matching Segment{matchedSegments.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-400">
            {totalMatchedDistance >= 1 
              ? `${totalMatchedDistance.toFixed(2)} km`
              : `${(totalMatchedDistance * 1000).toFixed(0)} m`
            }
          </span>
          <svg 
            className={`w-4 h-4 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2 max-h-[300px] overflow-y-auto">
          {pairGroups.map((group) => (
            <PairGroup
              key={`${group.trackAId}-${group.trackBId}`}
              group={group}
              highlightedId={highlightedId}
              selectedId={selectedId}
              onHover={setHighlightedSegment}
              onLeave={() => setHighlightedSegment(null)}
              onClick={setSelectedMatchedSegment}
            />
          ))}
        </div>
      )}
    </div>
  )
}
