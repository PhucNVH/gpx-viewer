import { CircleMarker, Tooltip } from 'react-leaflet'
import { useTrackStore, useSelectedTrack } from '../../store/useTrackStore'

export function PositionMarker() {
  const hoveredPoint = useTrackStore((state) => state.hoveredPoint)
  const selectedTrack = useSelectedTrack()
  
  if (!hoveredPoint || !selectedTrack) return null
  
  return (
    <CircleMarker
      center={[hoveredPoint.lat, hoveredPoint.lng]}
      radius={8}
      pathOptions={{
        color: '#fff',
        weight: 3,
        fillColor: selectedTrack.color,
        fillOpacity: 1,
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -10]}
        opacity={1}
        permanent
        className="elevation-tooltip"
      >
        <div className="text-xs font-medium space-y-0.5">
          <div>
            <span className="text-surface-900">{hoveredPoint.elevation.toFixed(0)} m</span>
            <span className="text-surface-500 ml-1">@ {hoveredPoint.distance.toFixed(2)} km</span>
          </div>
          {(hoveredPoint.heartRate !== undefined || hoveredPoint.cadence !== undefined) && (
            <div className="flex gap-2 text-[10px]">
              {hoveredPoint.heartRate !== undefined && (
                <span className="text-red-600">♥ {hoveredPoint.heartRate} bpm</span>
              )}
              {hoveredPoint.cadence !== undefined && (
                <span className="text-blue-600">⚡ {hoveredPoint.cadence} rpm</span>
              )}
            </div>
          )}
        </div>
      </Tooltip>
    </CircleMarker>
  )
}
