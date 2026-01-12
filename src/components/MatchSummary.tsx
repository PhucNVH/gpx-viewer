import { useMemo, useState } from 'react'
import { useMatchedSegments, useMatchingSettings } from '../store/useTrackStore'

interface MatchPairSummary {
  trackAId: string
  trackBId: string
  trackAName: string
  trackBName: string
  segmentCount: number
  totalDistance: number
}

export function MatchSummary() {
  const matchingSettings = useMatchingSettings()
  const matchedSegments = useMatchedSegments()
  const [isExpanded, setIsExpanded] = useState(true)
  
  // Group segments by track pairs
  const pairSummaries = useMemo((): MatchPairSummary[] => {
    const pairMap = new Map<string, MatchPairSummary>()
    
    for (const segment of matchedSegments) {
      const pairKey = `${segment.trackAId}-${segment.trackBId}`
      
      if (pairMap.has(pairKey)) {
        const existing = pairMap.get(pairKey)!
        existing.segmentCount += 1
        existing.totalDistance += segment.distance
      } else {
        pairMap.set(pairKey, {
          trackAId: segment.trackAId,
          trackBId: segment.trackBId,
          trackAName: segment.trackAName,
          trackBName: segment.trackBName,
          segmentCount: 1,
          totalDistance: segment.distance,
        })
      }
    }
    
    return Array.from(pairMap.values())
  }, [matchedSegments])
  
  if (!matchingSettings.enabled || matchedSegments.length === 0) {
    return null
  }
  
  const totalMatchedDistance = pairSummaries.reduce((sum, p) => sum + p.totalDistance, 0)
  
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
        <div className="px-3 pb-3 space-y-2">
          {pairSummaries.map((pair) => (
            <div
              key={`${pair.trackAId}-${pair.trackBId}`}
              className="flex items-center justify-between py-2 px-2.5 bg-surface-900/50 rounded-md"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-surface-300 truncate max-w-[80px]" title={pair.trackAName}>
                    {pair.trackAName}
                  </span>
                  <svg className="w-3 h-3 text-cyan-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span className="text-surface-300 truncate max-w-[80px]" title={pair.trackBName}>
                    {pair.trackBName}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs ml-2">
                <span className="text-surface-500">
                  {pair.segmentCount} seg{pair.segmentCount !== 1 ? 's' : ''}
                </span>
                <span className="text-cyan-400 font-mono">
                  {pair.totalDistance >= 1 
                    ? `${pair.totalDistance.toFixed(2)} km`
                    : `${(pair.totalDistance * 1000).toFixed(0)} m`
                  }
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
