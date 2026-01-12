import { GeoJSON } from 'react-leaflet'
import type { PathOptions } from 'leaflet'
import type { Feature } from 'geojson'
import { useTrackStore } from '../../store/useTrackStore'
import type { GpxTrack } from '../../types'

interface TrackLayerProps {
  track: GpxTrack
}

export function TrackLayer({ track }: TrackLayerProps) {
  const selectTrack = useTrackStore((state) => state.selectTrack)
  const selectedTrackId = useTrackStore((state) => state.selectedTrackId)
  
  const isSelected = track.id === selectedTrackId
  
  const style: PathOptions = {
    color: track.color,
    weight: isSelected ? 5 : 3,
    opacity: isSelected ? 1 : 0.8,
    lineCap: 'round',
    lineJoin: 'round',
  }
  
  const onEachFeature = (_feature: Feature, layer: L.Layer) => {
    layer.on({
      click: () => selectTrack(track.id),
      mouseover: (e) => {
        const target = e.target as L.Path
        if (!isSelected) {
          target.setStyle({ weight: 5, opacity: 1 })
        }
      },
      mouseout: (e) => {
        const target = e.target as L.Path
        if (!isSelected) {
          target.setStyle({ weight: 3, opacity: 0.8 })
        }
      },
    })
  }
  
  return (
    <GeoJSON
      key={`${track.id}-${isSelected}`}
      data={track.geojson}
      style={style}
      onEachFeature={onEachFeature}
    />
  )
}
