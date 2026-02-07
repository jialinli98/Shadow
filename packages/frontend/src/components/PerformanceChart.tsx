import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface PerformanceDataPoint {
  timestamp: number
  value: number
  label?: string
}

interface PerformanceChartProps {
  data: PerformanceDataPoint[]
  title: string
  valueLabel?: string
  type?: 'line' | 'area'
  color?: string
  height?: number
}

/**
 * Performance chart component using Recharts
 * Displays ROI, P&L, or other metrics over time
 */
export default function PerformanceChart({
  data,
  title,
  type = 'area',
  color = '#6366f1',
  height = 300,
}: PerformanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">No data available</p>
        </div>
      </div>
    )
  }

  // Format data for Recharts
  const chartData = data.map(point => ({
    time: point.label || new Date(point.timestamp).toLocaleDateString(),
    value: point.value,
  }))

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-sm">{payload[0].payload.time}</p>
          <p className={`text-lg font-semibold ${payload[0].value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {payload[0].value >= 0 ? '+' : ''}{payload[0].value.toFixed(2)}%
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>

      <ResponsiveContainer width="100%" height={height}>
        {type === 'area' ? (
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill="url(#colorValue)"
            />
          </AreaChart>
        ) : (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-xs text-gray-400">Current</div>
          <div className={`text-sm font-semibold ${chartData[chartData.length - 1]?.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {chartData[chartData.length - 1]?.value >= 0 ? '+' : ''}{chartData[chartData.length - 1]?.value.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Peak</div>
          <div className="text-sm font-semibold text-green-500">
            +{Math.max(...chartData.map(d => d.value)).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Lowest</div>
          <div className="text-sm font-semibold text-red-500">
            {Math.min(...chartData.map(d => d.value)).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Trade distribution pie chart
 */
interface TradeDistributionData {
  asset: string
  count: number
  volume: number
}

interface TradeDistributionChartProps {
  data: TradeDistributionData[]
  title: string
}

export function TradeDistributionChart({ data, title }: TradeDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400">No trades yet</p>
        </div>
      </div>
    )
  }

  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981']
  const total = data.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>

      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = (item.count / total) * 100
          return (
            <div key={item.asset}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">{item.asset}</span>
                <span className="text-sm text-gray-400">{item.count} trades ({percentage.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: colors[index % colors.length],
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Volume: ${item.volume.toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
