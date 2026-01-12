import { useState } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceArea,
} from 'recharts'

import type { ElevationChartProps } from './types'
import { useChartData } from './useChartData'
import { ChartTooltip } from './ChartTooltip'
import { DataToggleButton, HeartRateIcon, CadenceIcon } from './DataToggleButton'
import { MeasureButton } from './MeasureButton'
import { MaximizeButton } from './MaximizeButton'
import { ClearButton } from './ClearButton'
import { SegmentStats } from './SegmentStats'
import { EmptyState } from './EmptyState'
import { TrackIndicator } from './TrackIndicator'
import { SelectionHint } from './SelectionHint'

export function ElevationChart({ isMaximized = false, onToggleMaximize }: ElevationChartProps) {
  const [showHeartRate, setShowHeartRate] = useState(false)
  const [showCadence, setShowCadence] = useState(false)

  const {
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
  } = useChartData(isMaximized)

  if (!selectedTrack) {
    return <EmptyState type="no-track" isMaximized={isMaximized} />
  }

  if (selectedTrack.elevation.length === 0) {
    return <EmptyState type="no-data" isMaximized={isMaximized} />
  }

  const chartHeight = isMaximized ? 'h-[calc(100%-120px)]' : 'h-44'

  return (
    <div className={`flex flex-col gap-2 ${isMaximized ? 'h-full' : ''}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
          Elevation Profile
        </h3>
        <div className="flex items-center gap-2">
          {hasHeartRate && (
            <DataToggleButton
              isActive={showHeartRate}
              onClick={() => setShowHeartRate(!showHeartRate)}
              title="Toggle heart rate"
              label="HR"
              color="red"
              icon={<HeartRateIcon />}
            />
          )}
          {hasCadence && (
            <DataToggleButton
              isActive={showCadence}
              onClick={() => setShowCadence(!showCadence)}
              title="Toggle cadence"
              label="CAD"
              color="blue"
              icon={<CadenceIcon />}
            />
          )}
          
          <MeasureButton isSelecting={selectionMode} onClick={toggleSelectionMode} />
          
          {(segmentStart || segmentEnd) && (
            <ClearButton onClick={() => clearSegment()} />
          )}
          
          {onToggleMaximize && (
            <MaximizeButton isMaximized={isMaximized} onClick={onToggleMaximize} />
          )}
        </div>
      </div>

      {/* Segment Stats */}
      {segmentStats && (
        <SegmentStats stats={segmentStats} isMaximized={isMaximized} />
      )}

      {/* Selection hint */}
      {selectionMode && (
        <SelectionHint hasStart={!!segmentStart} hasEnd={!!segmentEnd} />
      )}

      {/* Track name indicator */}
      <TrackIndicator name={selectedTrack.name} color={selectedTrack.color} />

      {/* Chart */}
      <div className={`${chartHeight} w-full ${isMaximized ? 'flex-1 min-h-0' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ cursor: selectionMode ? 'crosshair' : 'default' }}
          >
            <defs>
              <linearGradient id={`gradient-${selectedTrack.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={selectedTrack.color} stopOpacity={0.4} />
                <stop offset="95%" stopColor={selectedTrack.color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="selection-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#334155"
              vertical={false}
            />
            <XAxis
              dataKey="distance"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
              label={{
                value: 'km',
                position: 'insideBottomRight',
                offset: -5,
                fill: '#64748b',
                fontSize: 10,
              }}
            />
            <YAxis
              yAxisId="elevation"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              domain={[
                Math.floor((elevationBounds.min - elevationBounds.padding) / 100) * 100,
                Math.ceil((elevationBounds.max + elevationBounds.padding) / 100) * 100,
              ]}
              tickFormatter={(value) => `${value}`}
              label={{
                value: 'm',
                position: 'insideTopLeft',
                offset: 10,
                fill: '#64748b',
                fontSize: 10,
              }}
            />
            {hasHeartRate && showHeartRate && (
              <YAxis
                yAxisId="heartRate"
                orientation="right"
                stroke="#ef4444"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={['dataMin - 10', 'dataMax + 10']}
                tickFormatter={(value) => `${value}`}
                hide={!isMaximized}
              />
            )}
            <Tooltip content={<ChartTooltip />} />
            
            {/* Selected segment highlight */}
            {startChartPoint && endChartPoint && (
              <ReferenceArea
                yAxisId="elevation"
                x1={Math.min(startChartPoint.distance, endChartPoint.distance)}
                x2={Math.max(startChartPoint.distance, endChartPoint.distance)}
                fill="url(#selection-gradient)"
                stroke="#f59e0b"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            )}
            
            {/* Elevation area */}
            <Area
              yAxisId="elevation"
              type="monotone"
              dataKey="elevation"
              stroke={selectedTrack.color}
              strokeWidth={2}
              fill={`url(#gradient-${selectedTrack.id})`}
            />
            
            {/* Heart rate line */}
            {hasHeartRate && showHeartRate && (
              <Line
                yAxisId="heartRate"
                type="monotone"
                dataKey="heartRate"
                stroke="#ef4444"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            )}
            
            {/* Cadence line */}
            {hasCadence && showCadence && (
              <Line
                yAxisId="elevation"
                type="monotone"
                dataKey="cadence"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            )}
            
            {/* Hover point */}
            {hoveredChartPoint && (
              <ReferenceDot
                yAxisId="elevation"
                x={hoveredChartPoint.distance}
                y={hoveredChartPoint.elevation}
                r={6}
                fill={selectedTrack.color}
                stroke="#fff"
                strokeWidth={2}
              />
            )}
            
            {/* Segment start point */}
            {startChartPoint && (
              <ReferenceDot
                yAxisId="elevation"
                x={startChartPoint.distance}
                y={startChartPoint.elevation}
                r={7}
                fill="#22c55e"
                stroke="#fff"
                strokeWidth={2}
              />
            )}
            
            {/* Segment end point */}
            {endChartPoint && (
              <ReferenceDot
                yAxisId="elevation"
                x={endChartPoint.distance}
                y={endChartPoint.elevation}
                r={7}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
