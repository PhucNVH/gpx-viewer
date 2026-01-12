import { useRef } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { useVisibleTracks } from '../../store/useTrackStore'
import { FitBounds } from './FitBounds'
import { TrackLayer } from './TrackLayer'
import { PositionMarker } from './PositionMarker'
import { SegmentOverlay } from './SegmentOverlay'
import { MatchOverlay } from './MatchOverlay'
import 'leaflet/dist/leaflet.css'

export function MapView() {
  const mapRef = useRef<LeafletMap | null>(null)
  const visibleTracks = useVisibleTracks()
  
  return (
    <MapContainer
      ref={mapRef}
      center={[48.8566, 2.3522]} // Paris as default center
      zoom={10}
      className="w-full h-full"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      
      {visibleTracks.map((track) => (
        <TrackLayer key={track.id} track={track} />
      ))}
      
      <MatchOverlay />
      <SegmentOverlay />
      <PositionMarker />
      <FitBounds tracks={visibleTracks} />
    </MapContainer>
  )
}
