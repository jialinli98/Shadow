import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatEther } from 'viem'
import { Users, TrendingUp, DollarSign, Activity } from 'lucide-react'
import axios from 'axios'
import TradingProfile from '../components/TradingProfile'
import TradingSessions from '../components/TradingSessions'
import SimpleTradeExecutor from '../components/SimpleTradeExecutor'
import SettlementSummary from '../components/SettlementSummary'

const REGISTRY_ADDRESS = (import.meta.env.VITE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function SimplifiedLeaderDashboard() {
  const { address, isConnected } = useAccount()
  const [activeCopiers, setActiveCopiers] = useState<any[]>([])
  const [metrics, setMetrics] = useState({
    totalCopiers: 0,
    totalVolume: '0',
    feesEarned: '0',
  })

  // Check if leader is registered
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

  // Fetch active copiers
  useEffect(() => {
    if (!address || !isRegistered) return

    const fetchCopiers = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/copiers/by-leader/${address}`)
        setActiveCopiers(response.data)
      } catch (error) {
        console.error('Failed to fetch copiers:', error)
      }
    }

    fetchCopiers()
    const interval = setInterval(fetchCopiers, 5000)
    return () => clearInterval(interval)
  }, [address, isRegistered])

  // Update metrics
  useEffect(() => {
    if (leaderProfile) {
      const profile = leaderProfile as any
      setMetrics({
        totalCopiers: Number(profile.activeCopierCount || profile[4] || 0),
        totalVolume: '0',
        feesEarned: formatEther(profile.totalFeesEarned || profile[5] || 0n),
      })
    }
  }, [leaderProfile])

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Shadow Protocol</h2>
          <p className="text-gray-400 mb-6">Privacy-preserving copy trading platform</p>
          <p className="text-sm text-gray-500">Please connect your wallet to continue</p>
        </div>
      </div>
    )
  }

  if (!isRegistered) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-8 mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Shadow Protocol</h1>
          <p className="text-gray-400">Privacy-preserving copy trading</p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Not Registered</h2>
          <p className="text-gray-400 mb-6">
            You need to register as a leader to access the dashboard. Please use the full registration flow.
          </p>
          <a
            href="/leader"
            className="inline-block px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition"
          >
            Go to Registration
          </a>
        </div>
      </div>
    )
  }

  const ensName = leaderProfile ? (leaderProfile as any)?.ensName || (leaderProfile as any)?.[1] : undefined

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Shadow Protocol</h1>
            <p className="text-gray-400">Privacy-preserving copy trading platform</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Performance Metrics</div>
            <div className="text-2xl font-bold text-white">{metrics.totalCopiers} Copiers</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={<Users className="w-6 h-6 text-indigo-500" />}
          label="Active Copiers"
          value={metrics.totalCopiers.toString()}
        />
        <MetricCard
          icon={<TrendingUp className="w-6 h-6 text-green-500" />}
          label="Total Volume"
          value={`${Number(metrics.totalVolume).toFixed(2)} USDC`}
        />
        <MetricCard
          icon={<DollarSign className="w-6 h-6 text-purple-500" />}
          label="Fees Earned"
          value={`${Number(metrics.feesEarned).toFixed(2)} USDC`}
        />
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">①</div>
          <span>Profile</span>
        </div>
        <div className="w-8 h-px bg-gray-700"></div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">②</div>
          <span>Sessions</span>
        </div>
        <div className="w-8 h-px bg-gray-700"></div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">③</div>
          <span>Execute</span>
        </div>
        <div className="w-8 h-px bg-gray-700"></div>
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center text-xs font-bold">④</div>
          <span>Settle</span>
        </div>
      </div>

      {/* Section 1: Trading Profile */}
      <div className="relative">
        <div className="absolute -left-4 top-6 w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold shadow-lg">①</div>
        <TradingProfile
          ensName={ensName}
          address={address as string}
          stats={{
            winRate: 73.5,
            roi: 284,
            totalTrades: 1247,
            sharpeRatio: 1.85
          }}
        />
      </div>

      {/* Section 2: Trading Sessions */}
      <div className="relative">
        <div className="absolute -left-4 top-6 w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold shadow-lg">②</div>
        <TradingSessions leaderAddress={address || ''} />
      </div>

      {/* Section 3: Execute Trade */}
      <div className="relative">
        <div className="absolute -left-4 top-6 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold shadow-lg">③</div>
        <SimpleTradeExecutor leaderAddress={address || ''} />
      </div>

      {/* Section 4: Settlement */}
      <div className="relative">
        <div className="absolute -left-4 top-6 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold shadow-lg">④</div>
        <SettlementSummary
          pendingTrades={8}
          netPosition="+3.0 ETH"
          estimatedGas={25}
          gasSavings={95}
        />
      </div>

      {/* Active Copiers Table */}
      {activeCopiers.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            Active Copiers
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-700">
                  <th className="pb-3 text-sm font-medium text-gray-400">Address</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Deposit</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">P&L</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {activeCopiers.map((copier, index) => (
                  <tr key={index} className="border-b border-gray-700/50">
                    <td className="py-3 text-sm font-mono text-white">
                      {copier.copierAddress.slice(0, 6)}...{copier.copierAddress.slice(-4)}
                    </td>
                    <td className="py-3 text-sm text-gray-300">
                      {formatEther(copier.deposit)} USDC
                    </td>
                    <td className={`py-3 text-sm font-semibold ${
                      copier.currentPnL >= 0 ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {copier.currentPnL >= 0 ? '+' : ''}{copier.currentPnL.toFixed(2)}%
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        copier.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {copier.isActive ? 'Active' : 'Paused'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer - Tech Attribution */}
      <footer className="mt-8 pt-6 border-t border-gray-800">
        <div className="text-center text-xs text-gray-500">
          Built on{' '}
          <span className="text-gray-400">ENS</span> •{' '}
          <span className="text-gray-400">State Channels</span> •{' '}
          <span className="text-gray-400">Uniswap V4</span>
        </div>
      </footer>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        {icon}
      </div>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  )
}
