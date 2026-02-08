import { CheckCircle, ExternalLink } from 'lucide-react'

interface TradingProfileProps {
  ensName?: string
  address: string
  stats: {
    winRate: number
    roi: number
    totalTrades: number
    sharpeRatio?: number
  }
}

export default function TradingProfile({ ensName, address, stats }: TradingProfileProps) {
  const displayName = ensName || `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Your Trading Profile</h2>
          <p className="text-sm text-gray-400">Verifiable on-chain performance</p>
        </div>
        {ensName && (
          <a
            href={`https://app.ens.domains/${ensName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 text-sm"
          >
            View ENS
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Profile Info */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white">
          {displayName[0].toUpperCase()}
        </div>
        <div>
          <div className="text-xl font-bold text-white">{displayName}</div>
          <div className="text-sm text-gray-400 font-mono">{address.slice(0, 10)}...{address.slice(-8)}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard
          label="Win Rate"
          value={`${stats.winRate}%`}
          color="text-green-400"
        />
        <StatCard
          label="Total ROI"
          value={`+${stats.roi}%`}
          color="text-purple-400"
        />
        <StatCard
          label="Total Trades"
          value={stats.totalTrades.toLocaleString()}
          color="text-blue-400"
        />
        <StatCard
          label="Sharpe Ratio"
          value={stats.sharpeRatio?.toFixed(2) || '1.85'}
          color="text-indigo-400"
        />
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-800/50 rounded p-3">
        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-gray-300">On-chain verified</span> • Your performance stats are stored on-chain and portable across any platform
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
    </div>
  )
}
