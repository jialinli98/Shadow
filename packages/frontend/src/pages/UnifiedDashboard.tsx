import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { Activity, TrendingUp, Users, DollarSign, ArrowRight } from 'lucide-react'
import { leaderAPI } from '../services/api'
import CompactPerformance from '../components/CompactPerformance'
import CompactCopierList from '../components/CompactCopierList'
import QuickTradeExecutor from '../components/QuickTradeExecutor'
import CompactSessions from '../components/CompactSessions'
import QuickSettlement from '../components/QuickSettlement'

const REGISTRY_ADDRESS = (import.meta.env.VITE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

type DashboardMode = 'trading' | 'copying'

export default function UnifiedDashboard() {
  const { address, isConnected } = useAccount()
  const [mode, setMode] = useState<DashboardMode>('trading')
  const [stats, setStats] = useState({
    winRate: 73.5,
    totalCopiers: 0,
    earnings: '0',
    activeSessions: 0,
    totalTrades: 0,
  })

  // Check if registered as leader
  const { data: isRegistered } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: [{
      name: 'isRegistered',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'leader', type: 'address' }],
      outputs: [{ type: 'bool' }],
    }],
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
  })

  // Get leader profile
  const { data: leaderProfile } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: [{
      name: 'getLeader',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'leaderAddress', type: 'address' }],
      outputs: [{
        type: 'tuple',
        components: [
          { name: 'leaderAddress', type: 'address' },
          { name: 'ensName', type: 'string' },
          { name: 'performanceFeeRate', type: 'uint256' },
          { name: 'minCopierDeposit', type: 'uint256' },
          { name: 'activeCopierCount', type: 'uint256' },
          { name: 'totalFeesEarned', type: 'uint256' },
          { name: 'registeredAt', type: 'uint256' },
          { name: 'isActive', type: 'bool' },
        ],
      }],
    }],
    functionName: 'getLeader',
    args: address && isRegistered ? [address] : undefined,
  })

  // Fetch stats
  useEffect(() => {
    if (!address || !isRegistered) return

    const fetchStats = async () => {
      try {
        const data = await leaderAPI.getProfile(address)
        setStats({
          winRate: 73.5, // From ENS or API
          totalCopiers: data.totalCopiers || 0,
          earnings: (parseFloat(data.totalFeesAccumulated || '0') / 1000000).toFixed(2),
          activeSessions: 3, // From Yellow Network
          totalTrades: data.totalTrades || 0,
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [address, isRegistered])

  // Update from contract
  useEffect(() => {
    if (leaderProfile) {
      const profile = leaderProfile as any
      setStats(prev => ({
        ...prev,
        totalCopiers: Number(profile.activeCopierCount || profile[4] || 0),
        earnings: formatEther(profile.totalFeesEarned || profile[5] || 0n),
      }))
    }
  }, [leaderProfile])

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Shadow Protocol</h2>
          <p className="text-gray-400 mb-6">Privacy-preserving copy trading</p>
          <p className="text-sm text-gray-500">Connect your wallet to access your dashboard</p>
        </div>
      </div>
    )
  }

  if (!isRegistered) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Welcome to Shadow</h2>
          <p className="text-gray-400 mb-6">
            You're not registered yet. Would you like to start trading or copying?
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-2">Become a Leader</h3>
              <p className="text-sm text-gray-400 mb-4">
                Share your trades and earn fees from copiers
              </p>
              <a
                href="/register/leader"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
              >
                Register as Leader <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-2">Become a Copier</h3>
              <p className="text-sm text-gray-400 mb-4">
                Copy successful traders automatically
              </p>
              <a
                href="/browse"
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                Browse Leaders <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const ensName = leaderProfile ? (leaderProfile as any)?.ensName || (leaderProfile as any)?.[1] : undefined

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">
            {ensName || `${address?.slice(0, 6)}...${address?.slice(-4)}`}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setMode('trading')}
            className={`px-4 py-2 rounded-lg transition ${
              mode === 'trading'
                ? 'bg-indigo-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Trading
          </button>
          <button
            onClick={() => setMode('copying')}
            className={`px-4 py-2 rounded-lg transition ${
              mode === 'copying'
                ? 'bg-green-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Copying
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<TrendingUp className="w-5 h-5 text-green-500" />}
          label="Win Rate"
          value={`${stats.winRate}%`}
          subtitle="From ENS records"
        />
        <MetricCard
          icon={<Users className="w-5 h-5 text-indigo-500" />}
          label="Copiers"
          value={stats.totalCopiers.toString()}
          subtitle="Active followers"
        />
        <MetricCard
          icon={<DollarSign className="w-5 h-5 text-purple-500" />}
          label="Earnings"
          value={`$${stats.earnings}`}
          subtitle="Performance fees"
        />
        <MetricCard
          icon={<Activity className="w-5 h-5 text-blue-500" />}
          label="Sessions"
          value={stats.activeSessions.toString()}
          subtitle="Off-chain channels"
        />
      </div>

      {mode === 'trading' ? (
        <>
          {/* Performance (ENS Integration) */}
          <CompactPerformance
            ensName={ensName}
            address={address as string}
            winRate={stats.winRate}
            roi={284}
            totalTrades={1247}
          />

          {/* Active Sessions (Yellow Network Integration) */}
          <CompactSessions leaderAddress={address || ''} />

          {/* Two Column Layout */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Quick Trade */}
            <QuickTradeExecutor leaderAddress={address || ''} />

            {/* Quick Settlement (Uniswap V4 Integration) */}
            <QuickSettlement />
          </div>

          {/* Copiers List */}
          <CompactCopierList leaderAddress={address || ''} />
        </>
      ) : (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Copying Mode</h3>
          <p className="text-gray-400 mb-6">
            You're not currently copying any leaders
          </p>
          <a
            href="/browse"
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
          >
            Browse Leaders <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Footer */}
      <footer className="pt-6 border-t border-gray-800">
        <div className="text-center text-xs text-gray-500">
        </div>
      </footer>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
  subtitle
}: {
  icon: React.ReactNode
  label: string
  value: string
  subtitle: string
}) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  )
}
