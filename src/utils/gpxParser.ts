import { gpx } from '@tmcw/togeojson'
import type { FeatureCollection } from 'geojson'
import type { ElevationPoint, GpxTrack } from '../types'
import { calculateCumulativeDistances } from './distance'
import { getNextColor } from './colorGenerator'

interface TrackPointData {
  lat: number
  lng: number
  elevation: number
  heartRate?: number
  cadence?: number
}

/**
 * Parse a GPX file and return a GpxTrack object
 * @param file - The GPX file to parse
 * @param storageId - Optional storage ID (UUID) from MinIO. If not provided, generates one.
 */
export async function parseGpxFile(file: File, storageId?: string): Promise<GpxTrack> {
  const text = await file.text()
  return parseGpxContent(text, file.name, storageId)
}

/**
 * Parse GPX content string and return a GpxTrack object
 * @param text - The GPX file content as string
 * @param fileName - Original file name (used for track name fallback)
 * @param storageId - Optional storage ID (UUID) from MinIO. If not provided, generates one.
 */
export function parseGpxContent(text: string, fileName: string, storageId?: string): GpxTrack {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'application/xml')
  
  // Check for parsing errors
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error(`Invalid GPX file: ${parseError.textContent}`)
  }
  
  // Convert to GeoJSON using togeojson library
  const geojson = gpx(doc) as FeatureCollection
  
  // Extract track name from GPX metadata or file name
  const nameElement = doc.querySelector('trk > name') || doc.querySelector('metadata > name')
  const trackName = nameElement?.textContent || fileName.replace(/\.gpx$/i, '')
  
  // Extract elevation data with HR and cadence from raw XML
  const elevation = extractTrackPointData(doc)
  
  return {
    id: crypto.randomUUID(),
    name: trackName,
    geojson,
    elevation,
    visible: true,
    color: getNextColor(),
    storageId: storageId || crypto.randomUUID(),
  }
}

/**
 * Parse multiple GPX files
 */
export async function parseGpxFiles(files: FileList | File[]): Promise<GpxTrack[]> {
  const fileArray = Array.from(files)
  const tracks = await Promise.all(
    fileArray.map(file => parseGpxFile(file).catch(err => {
      console.error(`Failed to parse ${file.name}:`, err)
      return null
    }))
  )
  return tracks.filter((track): track is GpxTrack => track !== null)
}

/**
 * Extract track point data including heart rate and cadence from GPX XML
 */
function extractTrackPointData(doc: Document): ElevationPoint[] {
  const elevationPoints: ElevationPoint[] = []
  const trackPoints = doc.querySelectorAll('trkpt')
  
  if (trackPoints.length === 0) return elevationPoints
  
  // First pass: collect all track point data
  const pointsData: TrackPointData[] = []
  
  trackPoints.forEach((trkpt) => {
    const lat = parseFloat(trkpt.getAttribute('lat') || '0')
    const lng = parseFloat(trkpt.getAttribute('lon') || '0')
    const eleElement = trkpt.querySelector('ele')
    const elevation = eleElement ? parseFloat(eleElement.textContent || '0') : 0
    
    // Extract heart rate from extensions
    // Try different common namespaces and element names
    const heartRate = extractExtensionValue(trkpt, ['hr', 'heartrate', 'gpxtpx:hr', 'ns3:hr'])
    
    // Extract cadence from extensions
    const cadence = extractExtensionValue(trkpt, ['cad', 'cadence', 'gpxtpx:cad', 'ns3:cad'])
    
    pointsData.push({
      lat,
      lng,
      elevation,
      heartRate: heartRate ?? undefined,
      cadence: cadence ?? undefined,
    })
  })
  
  // Second pass: calculate cumulative distances
  const coords = pointsData.map(p => [p.lng, p.lat])
  const distances = calculateCumulativeDistances(coords)
  
  // Combine data
  for (let i = 0; i < pointsData.length; i++) {
    elevationPoints.push({
      distance: distances[i],
      elevation: pointsData[i].elevation,
      lat: pointsData[i].lat,
      lng: pointsData[i].lng,
      heartRate: pointsData[i].heartRate,
      cadence: pointsData[i].cadence,
    })
  }
  
  return elevationPoints
}

/**
 * Extract a value from GPX extensions trying multiple possible element names
 */
function extractExtensionValue(trkpt: Element, possibleNames: string[]): number | null {
  const extensions = trkpt.querySelector('extensions')
  if (!extensions) return null
  
  for (const name of possibleNames) {
    // Try direct child
    let element = extensions.querySelector(name)
    
    // Try within TrackPointExtension
    if (!element) {
      const tpx = extensions.querySelector('TrackPointExtension') || 
                  extensions.querySelector('gpxtpx\\:TrackPointExtension') ||
                  extensions.querySelector('ns3\\:TrackPointExtension')
      if (tpx) {
        element = tpx.querySelector(name)
      }
    }
    
    // Try case-insensitive search
    if (!element) {
      const allChildren = extensions.getElementsByTagName('*')
      for (let i = 0; i < allChildren.length; i++) {
        const child = allChildren[i]
        if (child.localName.toLowerCase() === name.toLowerCase().replace(/^.*:/, '')) {
          element = child
          break
        }
      }
    }
    
    if (element && element.textContent) {
      const value = parseFloat(element.textContent)
      if (!isNaN(value)) return value
    }
  }
  
  return null
}
