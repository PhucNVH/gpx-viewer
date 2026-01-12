interface SegmentStatsData {
  distance: number
  netElevation: number
  avgSlope: number
  elevationGain: number
  elevationLoss: number
  maxSlope: number
}

interface SegmentStatsProps {
  stats: SegmentStatsData
  isMaximized?: boolean
}

export function SegmentStats({ stats, isMaximized = false }: SegmentStatsProps) {
  return (
    <div className={`grid ${isMaximized ? 'grid-cols-6' : 'grid-cols-3'} gap-2 p-2 rounded-lg bg-surface-800/50 border border-surface-700`}>
      <div className="text-center">
        <p className="text-[10px] text-surface-500 uppercase tracking-wider">Distance</p>
        <p className="text-sm font-semibold text-surface-100">{stats.distance.toFixed(2)} km</p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-surface-500 uppercase tracking-wider">Elevation</p>
        <p className={`text-sm font-semibold ${stats.netElevation >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {stats.netElevation >= 0 ? '+' : ''}{stats.netElevation.toFixed(0)} m
        </p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-surface-500 uppercase tracking-wider">Slope</p>
        <p className={`text-sm font-semibold ${stats.avgSlope >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {stats.avgSlope >= 0 ? '+' : ''}{stats.avgSlope.toFixed(1)}%
        </p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-surface-500 uppercase tracking-wider">Gain</p>
        <p className="text-xs text-emerald-400">↑ {stats.elevationGain.toFixed(0)} m</p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-surface-500 uppercase tracking-wider">Loss</p>
        <p className="text-xs text-red-400">↓ {stats.elevationLoss.toFixed(0)} m</p>
      </div>
      <div className="text-center">
        <p className="text-[10px] text-surface-500 uppercase tracking-wider">Max Slope</p>
        <p className="text-xs text-amber-400">{stats.maxSlope.toFixed(1)}%</p>
      </div>
    </div>
  )
}
