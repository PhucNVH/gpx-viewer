import { useState } from 'react'
import { Polyline, Tooltip } from 'react-leaflet'
import { useMatchedSegments, useMatchingSettings } from '../../store/useTrackStore'

export function MatchOverlay() {
  const matchingSettings = useMatchingSettings()
  const matchedSegments = useMatchedSegments()
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null)
  
  if (!matchingSettings.enabled || matchedSegments.length === 0) {
    return null
  }
  
  return (
    <>
      {matchedSegments.map((segment) => {
        const isHovered = hoveredSegmentId === segment.id
        const positions = segment.points.map(p => [p.lat, p.lng] as [number, number])
        
        return (
          <Polyline
            key={segment.id}
            positions={positions}
            pathOptions={{
              color: '#06b6d4', // cyan-500
              weight: isHovered ? 8 : 6,
              opacity: isHovered ? 1 : 0.85,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: isHovered ? undefined : '8, 4',
            }}
            eventHandlers={{
              mouseover: () => setHoveredSegmentId(segment.id),
              mouseout: () => setHoveredSegmentId(null),
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -8]}
              opacity={0.95}
              className="match-tooltip"
            >
              <div className="text-xs space-y-1 min-w-[140px]">
                <div className="font-semibold text-cyan-600">Matching Segment</div>
                <div className="text-gray-600">
                  <span className="font-medium">{segment.trackAName}</span>
                  <span className="mx-1 text-gray-400">&</span>
                  <span className="font-medium">{segment.trackBName}</span>
                </div>
                <div className="text-gray-500 pt-1 border-t border-gray-200">
                  {segment.distance >= 1 
                    ? `${segment.distance.toFixed(2)} km`
                    : `${(segment.distance * 1000).toFixed(0)} m`
                  }
                </div>
              </div>
            </Tooltip>
          </Polyline>
        )
      })}
    </>
  )
}
