import { useMemo } from 'react'
import { CircleMarker, Tooltip, Polyline } from 'react-leaflet'
import { useSelectedTrack, useCurrentSegment } from '../../store/useTrackStore'

export function SegmentOverlay() {
  const selectedTrack = useSelectedTrack()
  const { start: segmentStart, end: segmentEnd } = useCurrentSegment()
  
  // Get coordinates for the segment polyline
  const segmentCoords = useMemo(() => {
    if (!selectedTrack || !segmentStart || !segmentEnd) return []
    
    const startIdx = Math.min(segmentStart.index, segmentEnd.index)
    const endIdx = Math.max(segmentStart.index, segmentEnd.index)
    
    return selectedTrack.elevation
      .slice(startIdx, endIdx + 1)
      .map(point => [point.lat, point.lng] as [number, number])
  }, [selectedTrack, segmentStart, segmentEnd])
  
  if (!selectedTrack) return null
  
  return (
    <>
      {/* Segment highlight line */}
      {segmentCoords.length > 1 && (
        <Polyline
          positions={segmentCoords}
          pathOptions={{
            color: '#f59e0b',
            weight: 6,
            opacity: 0.8,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}
      
      {/* Start point marker */}
      {segmentStart && (
        <CircleMarker
          center={[segmentStart.lat, segmentStart.lng]}
          radius={10}
          pathOptions={{
            color: '#fff',
            weight: 3,
            fillColor: '#22c55e',
            fillOpacity: 1,
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -12]}
            opacity={1}
            permanent
            className="segment-tooltip"
          >
            <div className="text-xs font-bold text-emerald-600">START</div>
            <div className="text-[10px] text-gray-600">
              {segmentStart.elevation.toFixed(0)} m
            </div>
          </Tooltip>
        </CircleMarker>
      )}
      
      {/* End point marker */}
      {segmentEnd && (
        <CircleMarker
          center={[segmentEnd.lat, segmentEnd.lng]}
          radius={10}
          pathOptions={{
            color: '#fff',
            weight: 3,
            fillColor: '#ef4444',
            fillOpacity: 1,
          }}
        >
          <Tooltip
            direction="top"
            offset={[0, -12]}
            opacity={1}
            permanent
            className="segment-tooltip"
          >
            <div className="text-xs font-bold text-red-600">END</div>
            <div className="text-[10px] text-gray-600">
              {segmentEnd.elevation.toFixed(0)} m
            </div>
          </Tooltip>
        </CircleMarker>
      )}
    </>
  )
}
