import { useMemo, useCallback } from 'react'
import { useSelectedTrack, useTrackStore, useCurrentSegment, calculateSegmentStats, useSelectedMatchedSegmentData } from '../../store/useTrackStore'
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
  const clearSelectedMatchedSegment = useTrackStore((state) => state.setSelectedMatchedSegment)
  const { start: segmentStart, end: segmentEnd } = useCurrentSegment()
  
  // Get selected matched segment data
  const matchedSegmentData = useSelectedMatchedSegmentData()

  // Check if showing matched segment view
  const isShowingMatchedSegment = !!matchedSegmentData

  // Check if track has HR/cadence data
  const hasHeartRate = useMemo(() => {
    return selectedTrack?.elevation.some(p => p.heartRate !== undefined) ?? false
  }, [selectedTrack])
  
  const hasCadence = useMemo(() => {
    return selectedTrack?.elevation.some(p => p.cadence !== undefined) ?? false
  }, [selectedTrack])

  // Helper to normalize distance to start from 0
  const normalizeElevationData = (elevation: ElevationPoint[]) => {
    if (elevation.length === 0) return []
    const startDistance = elevation[0].distance
    return elevation.map(p => ({
      ...p,
      distance: p.distance - startDistance
    }))
  }

  // Chart data for matched segment (both tracks)
  const matchedChartDataA = useMemo(() => {
    if (!matchedSegmentData) return []
    
    const normalized = normalizeElevationData(matchedSegmentData.trackAElevation)
    const maxPoints = isMaximized ? 500 : 200
    const step = Math.max(1, Math.floor(normalized.length / maxPoints))
    
    return normalized
      .filter((_, i) => i % step === 0)
      .map((point, i) => ({
        distance: Number(point.distance.toFixed(3)),
        elevation: Math.round(point.elevation),
        elevationA: Math.round(point.elevation),
        lat: point.lat,
        lng: point.lng,
        originalIndex: i * step,
        heartRate: point.heartRate,
        cadence: point.cadence,
      }))
  }, [matchedSegmentData, isMaximized])

  const matchedChartDataB = useMemo(() => {
    if (!matchedSegmentData) return []
    
    const normalized = normalizeElevationData(matchedSegmentData.trackBElevation)
    const maxPoints = isMaximized ? 500 : 200
    const step = Math.max(1, Math.floor(normalized.length / maxPoints))
    
    return normalized
      .filter((_, i) => i % step === 0)
      .map((point, i) => ({
        distance: Number(point.distance.toFixed(3)),
        elevation: Math.round(point.elevation),
        elevationB: Math.round(point.elevation),
        lat: point.lat,
        lng: point.lng,
        originalIndex: i * step,
      }))
  }, [matchedSegmentData, isMaximized])

  // Combine both tracks for matched segment view (merge by distance)
  const matchedChartData = useMemo(() => {
    if (!matchedSegmentData || matchedChartDataA.length === 0) return []

    // Create a combined data set with both elevations
    const combined: Array<{
      distance: number
      elevationA?: number
      elevationB?: number
      lat: number
      lng: number
      originalIndex: number
    }> = []

    // Add all track A points
    for (const point of matchedChartDataA) {
      combined.push({
        distance: point.distance,
        elevationA: point.elevationA,
        lat: point.lat,
        lng: point.lng,
        originalIndex: point.originalIndex,
      })
    }

    // Interpolate track B values at track A distances
    for (const point of combined) {
      // Find closest B points
      const sortedB = [...matchedChartDataB].sort(
        (a, b) => Math.abs(a.distance - point.distance) - Math.abs(b.distance - point.distance)
      )
      if (sortedB.length > 0) {
        const closest = sortedB[0]
        // Only add if close enough (within 5% of segment length or 0.1km)
        const maxSegmentDist = Math.max(...matchedChartDataA.map(p => p.distance))
        const threshold = Math.max(0.1, maxSegmentDist * 0.05)
        if (Math.abs(closest.distance - point.distance) <= threshold) {
          point.elevationB = closest.elevationB
        }
      }
    }

    return combined.sort((a, b) => a.distance - b.distance)
  }, [matchedSegmentData, matchedChartDataA, matchedChartDataB])

  // Downsample data for better performance (regular track view)
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

  // Calculate elevation bounds (for regular track or matched segment)
  const elevationBounds = useMemo(() => {
    if (isShowingMatchedSegment && matchedChartData.length > 0) {
      const allElevations = matchedChartData.flatMap(d => [d.elevationA, d.elevationB].filter((e): e is number => e !== undefined))
      if (allElevations.length === 0) return { min: 0, max: 0, padding: 50 }
      const min = Math.min(...allElevations)
      const max = Math.max(...allElevations)
      const padding = Math.max(50, (max - min) * 0.1)
      return { min, max, padding }
    }
    
    if (chartData.length === 0) return { min: 0, max: 0, padding: 50 }
    const min = Math.min(...chartData.map((d) => d.elevation))
    const max = Math.max(...chartData.map((d) => d.elevation))
    const padding = Math.max(50, (max - min) * 0.1)
    return { min, max, padding }
  }, [chartData, matchedChartData, isShowingMatchedSegment])

  // Clear matched segment selection
  const clearMatchedSegment = useCallback(() => {
    clearSelectedMatchedSegment(null)
  }, [clearSelectedMatchedSegment])

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
    // Matched segment data
    isShowingMatchedSegment,
    matchedSegmentData,
    matchedChartData,
    clearMatchedSegment,
  }
}
