export interface ChartDataPoint {
  distance: number
  elevation: number
  lat: number
  lng: number
  originalIndex: number
  heartRate?: number
  cadence?: number
}

export interface ElevationChartProps {
  isMaximized?: boolean
  onToggleMaximize?: () => void
}
