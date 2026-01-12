import { useState, memo, useMemo } from 'react'
import { Polyline, Tooltip, Marker } from 'react-leaflet'
import L from 'leaflet'
import { 
  useMatchedSegments, 
  useMatchingSettings, 
  useMatchingLoading,
  useHighlightedSegmentId,
  useSelectedMatchedSegmentId,
  useTrackStore,
} from '../../store/useTrackStore'
import type { MatchedSegment } from '../../types'

// Calculate bearing between two points
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => deg * (Math.PI / 180)
  const toDeg = (rad: number) => rad * (180 / Math.PI)
  
  const dLon = toRad(lng2 - lng1)
  const y = Math.sin(dLon) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon)
  
  let bearing = toDeg(Math.atan2(y, x))
  return (bearing + 360) % 360
}

// Create arrow icon with rotation
function createArrowIcon(rotation: number, isActive: boolean): L.DivIcon {
  const size = isActive ? 16 : 12
  const color = isActive ? '#22d3ee' : '#06b6d4'
  
  return L.divIcon({
    className: 'direction-arrow',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        transform: rotate(${rotation}deg);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
          <path d="M12 2L4 14h5v8h6v-8h5L12 2z"/>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// Custom start marker icon (green circle with play icon)
const startIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #10b981, #059669);
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
        <path d="M8 5v14l11-7z"/>
      </svg>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

// Custom end marker icon (red circle with stop icon)
const endIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
        <rect x="6" y="6" width="12" height="12"/>
      </svg>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

// Calculate positions for direction arrows along a path
function getArrowPositions(
  points: Array<{ lat: number; lng: number }>,
  intervalMeters: number = 500
): Array<{ lat: number; lng: number; bearing: number }> {
  if (points.length < 2) return []
  
  const arrows: Array<{ lat: number; lng: number; bearing: number }> = []
  let accumulatedDistance = 0
  
  // Always add first arrow at ~20% of first segment
  if (points.length >= 2) {
    const firstBearing = calculateBearing(
      points[0].lat, points[0].lng,
      points[1].lat, points[1].lng
    )
    const firstArrowLat = points[0].lat + (points[1].lat - points[0].lat) * 0.3
    const firstArrowLng = points[0].lng + (points[1].lng - points[0].lng) * 0.3
    arrows.push({ lat: firstArrowLat, lng: firstArrowLng, bearing: firstBearing })
  }
  
  // Calculate distance in meters between two points
  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371000 // meters
    const toRad = (deg: number) => deg * (Math.PI / 180)
    const dLat = toRad(lat2 - lat1)
    const dLon = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  
  for (let i = 1; i < points.length; i++) {
    const segmentDist = haversineDistance(
      points[i - 1].lat, points[i - 1].lng,
      points[i].lat, points[i].lng
    )
    
    accumulatedDistance += segmentDist
    
    // Add arrow at each interval
    if (accumulatedDistance >= intervalMeters) {
      const bearing = calculateBearing(
        points[i - 1].lat, points[i - 1].lng,
        points[i].lat, points[i].lng
      )
      arrows.push({ lat: points[i].lat, lng: points[i].lng, bearing })
      accumulatedDistance = 0
    }
  }
  
  return arrows
}

// Direction arrows component
const DirectionArrows = memo(function DirectionArrows({
  segment,
  isActive,
}: {
  segment: MatchedSegment
  isActive: boolean
}) {
  const arrows = useMemo(() => {
    // More frequent arrows for active segment
    const interval = isActive ? 300 : 600
    return getArrowPositions(segment.points, interval)
  }, [segment.points, isActive])
  
  if (arrows.length === 0) return null
  
  return (
    <>
      {arrows.map((arrow, idx) => (
        <Marker
          key={`arrow-${segment.id}-${idx}`}
          position={[arrow.lat, arrow.lng]}
          icon={createArrowIcon(arrow.bearing - 180, isActive)} // -180 because SVG arrow points up
          interactive={false}
        />
      ))}
    </>
  )
})

// Memoized segment polyline to prevent unnecessary re-renders
const SegmentPolyline = memo(function SegmentPolyline({
  segment,
  isHighlighted,
  isSelected,
  isDimmed,
  onMouseOver,
  onMouseOut,
  onClick,
}: {
  segment: MatchedSegment
  isHighlighted: boolean
  isSelected: boolean
  isDimmed: boolean
  onMouseOver: () => void
  onMouseOut: () => void
  onClick: () => void
}) {
        const positions = segment.points.map(p => [p.lat, p.lng] as [number, number])
  
  // Determine visual state
  const isActive = isHighlighted || isSelected
  const weight = isActive ? 8 : isDimmed ? 3 : 5
  const opacity = isDimmed ? 0.25 : isActive ? 1 : 0.8
  const color = isActive ? '#22d3ee' : '#06b6d4' // cyan-400 when active, cyan-500 otherwise
        
        return (
    <>
      {/* Main polyline */}
          <Polyline
            positions={positions}
            pathOptions={{
          color,
          weight,
          opacity,
              lineCap: 'round',
              lineJoin: 'round',
            }}
            eventHandlers={{
          mouseover: onMouseOver,
          mouseout: onMouseOut,
          click: onClick,
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
      
      {/* Direction arrows */}
      {!isDimmed && (
        <DirectionArrows segment={segment} isActive={isActive} />
      )}
    </>
  )
})

// Create direction badge icon
function createDirectionBadge(directionLabel: string, bearing: number): L.DivIcon {
  return L.divIcon({
    className: 'direction-badge',
    html: `
      <div style="
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background: linear-gradient(135deg, #0891b2, #06b6d4);
        border: 2px solid white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        white-space: nowrap;
      ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="white" style="transform: rotate(${bearing}deg)">
          <path d="M12 2L4 14h5v8h6v-8h5L12 2z"/>
        </svg>
        <span style="color: white; font-size: 11px; font-weight: 600;">${directionLabel}</span>
      </div>
    `,
    iconSize: [60, 24],
    iconAnchor: [30, 12],
  })
}

// Start and end markers for highlighted/selected segment
const SegmentMarkers = memo(function SegmentMarkers({
  segment,
}: {
  segment: MatchedSegment
}) {
  if (segment.points.length < 2) return null
  
  const startPoint = segment.points[0]
  const endPoint = segment.points[segment.points.length - 1]
  
  // Calculate midpoint for direction badge
  const midIndex = Math.floor(segment.points.length / 2)
  const midPoint = segment.points[midIndex]
  
  return (
    <>
      {/* Start marker */}
      <Marker
        position={[startPoint.lat, startPoint.lng]}
        icon={startIcon}
        zIndexOffset={1000}
      >
        <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
          <div className="text-xs font-medium text-emerald-600">Start</div>
        </Tooltip>
      </Marker>
      
      {/* Direction badge at midpoint */}
      <Marker
        position={[midPoint.lat, midPoint.lng]}
        icon={createDirectionBadge(segment.directionLabel, segment.direction)}
        zIndexOffset={900}
        interactive={false}
      />
      
      {/* End marker */}
      <Marker
        position={[endPoint.lat, endPoint.lng]}
        icon={endIcon}
        zIndexOffset={1000}
      >
        <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
          <div className="text-xs font-medium text-red-600">End</div>
        </Tooltip>
      </Marker>
    </>
  )
})

export function MatchOverlay() {
  const matchingSettings = useMatchingSettings()
  const matchedSegments = useMatchedSegments()
  const isLoading = useMatchingLoading()
  const highlightedId = useHighlightedSegmentId()
  const selectedId = useSelectedMatchedSegmentId()
  const setHighlightedSegment = useTrackStore((state) => state.setHighlightedSegment)
  const setSelectedMatchedSegment = useTrackStore((state) => state.setSelectedMatchedSegment)
  const [mapHoveredId, setMapHoveredId] = useState<string | null>(null)
  
  // Find the active segment (highlighted or selected)
  const activeSegment = useMemo(() => {
    const activeId = highlightedId || selectedId
    if (!activeId) return null
    return matchedSegments.find(s => s.id === activeId) || null
  }, [matchedSegments, highlightedId, selectedId])
  
  // Determine if any segment is active (for dimming others)
  const hasActiveSegment = highlightedId !== null || selectedId !== null || mapHoveredId !== null
  
  if (!matchingSettings.enabled || (matchedSegments.length === 0 && !isLoading)) {
    return null
  }
  
  return (
    <>
      {/* Render all segments */}
      {matchedSegments.map((segment) => {
        const isHighlighted = highlightedId === segment.id || mapHoveredId === segment.id
        const isSelected = selectedId === segment.id
        const isDimmed = hasActiveSegment && !isHighlighted && !isSelected
        
        return (
          <SegmentPolyline
            key={segment.id}
            segment={segment}
            isHighlighted={isHighlighted}
            isSelected={isSelected}
            isDimmed={isDimmed}
            onMouseOver={() => {
              setMapHoveredId(segment.id)
              setHighlightedSegment(segment.id)
            }}
            onMouseOut={() => {
              setMapHoveredId(null)
              setHighlightedSegment(null)
            }}
            onClick={() => setSelectedMatchedSegment(segment.id)}
          />
        )
      })}
      
      {/* Start/End markers for active segment */}
      {activeSegment && (
        <SegmentMarkers segment={activeSegment} />
      )}
    </>
  )
}
