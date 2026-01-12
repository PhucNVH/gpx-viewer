import type { TooltipProps } from 'recharts'
import type { ChartDataPoint } from './types'

export function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null
  
  const data = payload[0].payload as ChartDataPoint
  
  return (
    <div className="bg-surface-800 border border-surface-700 rounded-lg p-3 shadow-xl">
      <p className="text-xs text-surface-400 mb-2">Distance: {label} km</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-500" />
          <span className="text-sm text-surface-100">{data.elevation} m</span>
          <span className="text-xs text-surface-500">elevation</span>
        </div>
        {data.heartRate !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm text-surface-100">{data.heartRate} bpm</span>
            <span className="text-xs text-surface-500">heart rate</span>
          </div>
        )}
        {data.cadence !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm text-surface-100">{data.cadence} rpm</span>
            <span className="text-xs text-surface-500">cadence</span>
          </div>
        )}
      </div>
    </div>
  )
}
