import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import type { GpxTrack } from '../../types'

interface FitBoundsProps {
  tracks: GpxTrack[]
}

export function FitBounds({ tracks }: FitBoundsProps) {
  const map = useMap()
  const prevTracksRef = useRef<string>('')
  
  useEffect(() => {
    const trackIds = tracks.map(t => t.id).sort().join(',')
    
    // Only fit bounds when tracks change
    if (trackIds !== prevTracksRef.current && tracks.length > 0) {
      prevTracksRef.current = trackIds
      
      // Collect all coordinates
      const allCoords: [number, number][] = []
      
      for (const track of tracks) {
        for (const feature of track.geojson.features) {
          if (feature.geometry.type === 'LineString') {
            for (const coord of feature.geometry.coordinates) {
              allCoords.push([coord[1], coord[0]])
            }
          } else if (feature.geometry.type === 'MultiLineString') {
            for (const line of feature.geometry.coordinates) {
              for (const coord of line) {
                allCoords.push([coord[1], coord[0]])
              }
            }
          }
        }
      }
      
      if (allCoords.length > 0) {
        map.fitBounds(allCoords, { padding: [50, 50] })
      }
    }
  }, [map, tracks])
  
  return null
}
