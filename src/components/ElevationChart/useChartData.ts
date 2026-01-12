import { useMemo, useCallback } from 'react'
import { useSelectedTrack, useTrackStore, useCurrentSegment, calculateSegmentStats } from '../../store/useTrackStore'
import type { ElevationPoint } from '../../types'
import type { ChartDataPoint } from './types'

export function useChartData(isMaximized: boolean) {
  const selectedTrack = useSelectedTrack()
  const setHoveredPoint = useTrackStore((state) => state.setHoveredPoint)
  const hoveredPoint = useTrackStore((state) => state.hoveredPoint)
  const selectionMode = useTrackStore((state) => state.selectionMode)
  const toggleSelectionMode = useTrackStore((state) => state.toggleSelectionMode)
  const setSegmentPoint = useTrackStore((state) => state.setSegmentPoint)
  const clearSegment = useTrackStore((state) => state.clearSegment)
  const { start: segmentStart, end: segmentEnd } = useCurrentSegment()

  // Check if track has HR/cadence data
  const hasHeartRate = useMemo(() => {
    return selectedTrack?.elevation.some(p => p.heartRate !== undefined) ?? false
  }, [selectedTrack])
  
  const hasCadence = useMemo(() => {
    return selectedTrack?.elevation.some(p => p.cadence !== undefined) ?? false
  }, [selectedTrack])

  // Downsample data for better performance
  const chartData = useMemo(() => {
    if (!selectedTrack || selectedTrack.elevation.length === 0) return []
    
    const maxPoints = isMaximized ? 500 : 200
    const step = Math.max(1, Math.floor(selectedTrack.elevation.length / maxPoints))
    return selectedTrack.elevation
      .filter((_, i) => i % step === 0)
      .map((point: ElevationPoint, i) => ({
        distance: Number(point.distance.toFixed(2)),
        elevation: Math.round(point.elevation),
        lat: point.lat,
        lng: point.lng,
        originalIndex: i * step,
        heartRate: point.heartRate,
        cadence: point.cadence,
      }))
  }, [selectedTrack, isMaximized])

  const handleMouseMove = useCallback((data: { activePayload?: { payload: ChartDataPoint }[] }) => {
    if (data.activePayload && data.activePayload.length > 0) {
      const point = data.activePayload[0].payload
      setHoveredPoint({
        lat: point.lat,
        lng: point.lng,
        distance: point.distance,
        elevation: point.elevation,
        heartRate: point.heartRate,
        cadence: point.cadence,
      })
    }
  }, [setHoveredPoint])

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null)
  }, [setHoveredPoint])

  const handleClick = useCallback((data: { activePayload?: { payload: ChartDataPoint }[] }) => {
    if (!selectionMode || !data.activePayload || data.activePayload.length === 0) return
    
    const point = data.activePayload[0].payload
    setSegmentPoint({
      lat: point.lat,
      lng: point.lng,
      distance: point.distance,
      elevation: point.elevation,
      index: point.originalIndex,
    })
  }, [selectionMode, setSegmentPoint])

  // Calculate segment stats
  const segmentStats = useMemo(() => {
    if (!selectedTrack || !segmentStart || !segmentEnd) return null
    return calculateSegmentStats(
      selectedTrack.elevation,
      segmentStart.index,
      segmentEnd.index
    )
  }, [selectedTrack, segmentStart, segmentEnd])

  // Find the hovered point in chart data for the reference dot
  const hoveredChartPoint = useMemo(() => {
    return hoveredPoint
      ? chartData.find((d) => d.distance === hoveredPoint.distance)
      : null
  }, [hoveredPoint, chartData])

  // Find segment points in chart data
  const startChartPoint = useMemo(() => {
    return segmentStart
      ? chartData.reduce((closest, d) => 
          Math.abs(d.originalIndex - segmentStart.index) < Math.abs(closest.originalIndex - segmentStart.index) ? d : closest
        , chartData[0])
      : null
  }, [segmentStart, chartData])
  
  const endChartPoint = useMemo(() => {
    return segmentEnd
      ? chartData.reduce((closest, d) => 
          Math.abs(d.originalIndex - segmentEnd.index) < Math.abs(closest.originalIndex - segmentEnd.index) ? d : closest
        , chartData[0])
      : null
  }, [segmentEnd, chartData])

  // Calculate elevation bounds
  const elevationBounds = useMemo(() => {
    if (chartData.length === 0) return { min: 0, max: 0, padding: 50 }
    const min = Math.min(...chartData.map((d) => d.elevation))
    const max = Math.max(...chartData.map((d) => d.elevation))
    const padding = Math.max(50, (max - min) * 0.1)
    return { min, max, padding }
  }, [chartData])

  return {
    selectedTrack,
    chartData,
    hasHeartRate,
    hasCadence,
    selectionMode,
    toggleSelectionMode,
    segmentStart,
    segmentEnd,
    clearSegment,
    segmentStats,
    hoveredChartPoint,
    startChartPoint,
    endChartPoint,
    elevationBounds,
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  }
}
