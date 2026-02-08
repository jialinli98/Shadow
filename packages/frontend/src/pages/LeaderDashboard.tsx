import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { TrendingUp, Users, DollarSign, Activity } from 'lucide-react'
import { leaderAPI } from '../services/api'
import TradeExecutor from '../components/TradeExecutor'
import SettlementPanel from '../components/SettlementPanel'
import ENSProfileDisplay from '../components/ENSProfileDisplay'
import ENSMetadata from '../components/ENSMetadata'
import YellowStateChannelDashboard from '../components/YellowStateChannelDashboard'
import YellowChannelLifecycle from '../components/YellowChannelLifecycle'
import YellowBatchSettlement from '../components/YellowBatchSettlement'

const REGISTRY_ADDRESS = (import.meta.env.VITE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

export default function LeaderDashboard() {
  const { address, isConnected } = useAccount()
  const [ensName, setEnsName] = useState('')
  const [performanceFee, setPerformanceFee] = useState(1500) // 15%
  const [minDeposit, setMinDeposit] = useState('500')
  const [leaderStats, setLeaderStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    totalCopiers: 0,
    activeCopiers: 0,
    totalVolume: '0',
    feesEarned: '0',
    totalTrades: 0,
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

  // Get leader profile if registered
  const { data: leaderProfile, isError: profileError, isLoading: profileLoading } = useReadContract({
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


  // Register leader
  const { writeContract: registerLeader, isPending: isRegistering } = useWriteContract()

  // Fetch leader stats from new API
  useEffect(() => {
    if (!address || !isRegistered) return

    const fetchLeaderStats = async () => {
      try {
        setLoading(true)
        const stats = await leaderAPI.getProfile(address)
        setLeaderStats(stats)

        // Update metrics from new API
        setMetrics({
          totalCopiers: stats.totalCopiers || 0,
          activeCopiers: stats.activeCopiers || 0,
          totalVolume: (parseFloat(stats.totalVolume || '0') / 1000000).toFixed(2),
          feesEarned: (parseFloat(stats.totalFeesAccumulated || '0') / 1000000).toFixed(2),
          totalTrades: stats.totalTrades || 0,
        })
      } catch (error) {
        console.error('Failed to fetch leader stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderStats()
    const interval = setInterval(fetchLeaderStats, 10000)
    return () => clearInterval(interval)
  }, [address, isRegistered])

  // Update metrics from contract data (supplement API data)
  useEffect(() => {
    if (leaderProfile) {
      const profile = leaderProfile as any
      setMetrics(prev => ({
        ...prev,
        totalCopiers: Number(profile.activeCopierCount || profile[4] || prev.totalCopiers),
        feesEarned: formatEther(profile.totalFeesEarned || profile[5] || 0n),
      }))
    }
  }, [leaderProfile])

  const handleRegister = async () => {
    if (!ensName || !address) return

    try {
      registerLeader({
        address: REGISTRY_ADDRESS,
        abi: [{
          name: 'registerLeader',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'ensName', type: 'string' },
            { name: 'performanceFee', type: 'uint256' },
            { name: 'minCopierDeposit', type: 'uint256' },
          ],
          outputs: [],
        }],
        functionName: 'registerLeader',
        args: [ensName, BigInt(performanceFee), parseEther(minDeposit)],
      })
    } catch (error) {
      console.error('Registration failed:', error)
    }
  }

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to access the Leader Dashboard</p>
      </div>
    )
  }

  if (!isRegistered) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Become a Leader</h1>

        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">Leader Registration</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                ENS Name
              </label>
              <input
                type="text"
                value={ensName}
                onChange={(e) => setEnsName(e.target.value)}
                placeholder="your-name.eth"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-sm text-gray-400 mt-1">Your ENS profile will be used to display your trading strategy</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Performance Fee: {(performanceFee / 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min="0"
                max="3000"
                step="50"
                value={performanceFee}
                onChange={(e) => setPerformanceFee(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-sm text-gray-400 mt-1">You earn this % of copier profits (max 30%)</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum Copier Deposit (USDC)
              </label>
              <input
                type="number"
                value={minDeposit}
                onChange={(e) => setMinDeposit(e.target.value)}
                placeholder="500"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-sm text-gray-400 mt-1">Minimum deposit required for copiers to follow you</p>
            </div>

            <button
              onClick={handleRegister}
              disabled={isRegistering || !ensName}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRegistering ? 'Registering...' : 'Register as Leader'}
            </button>
          </div>
        </div>

        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">How it works</h3>
          <ul className="text-sm text-gray-300 space-y-2">
            <li>1. Register with your ENS name and set your performance fee</li>
            <li>2. Execute trades through Shadow relay (off-chain in Yellow state channels)</li>
            <li>3. Copiers automatically replicate your trades proportionally</li>
            <li>4. Earn fees when your copiers profit (withdrawn anytime)</li>
            <li>5. All trades settle via Uniswap V4 - only net position visible on-chain</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-white">Leader Dashboard</h1>
        <div className="text-right">
          <div className="text-sm text-gray-400">ENS Profile</div>
          <div className="text-lg font-semibold text-white">
            {profileLoading ? 'Loading...' : profileError ? 'Error loading profile' : (leaderProfile as any)?.ensName || (leaderProfile as any)?.[1] || 'Unknown'}
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          icon={<Users className="w-8 h-8 text-indigo-500" />}
          label="Active Copiers"
          value={`${metrics.activeCopiers} / ${metrics.totalCopiers}`}
        />
        <MetricCard
          icon={<Activity className="w-8 h-8 text-blue-500" />}
          label="Total Trades"
          value={metrics.totalTrades.toString()}
        />
        <MetricCard
          icon={<TrendingUp className="w-8 h-8 text-green-500" />}
          label="Total Volume"
          value={`$${metrics.totalVolume}M`}
        />
        <MetricCard
          icon={<DollarSign className="w-8 h-8 text-purple-500" />}
          label="Fees Earned"
          value={`$${metrics.feesEarned}M`}
        />
      </div>

      {/* Copier Stats */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
        <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
          <Users className="w-6 h-6 mr-2 text-indigo-500" />
          Copier Stats
        </h2>

        {loading ? (
          <p className="text-gray-400 text-center py-8">Loading copier stats...</p>
        ) : metrics.totalCopiers === 0 ? (
          <p className="text-gray-400 text-center py-8">No copiers yet. Share your ENS profile to attract followers!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Total Copiers</div>
              <div className="text-3xl font-bold text-white">{metrics.totalCopiers}</div>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Active Now</div>
              <div className="text-3xl font-bold text-green-500">{metrics.activeCopiers}</div>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-4">
              <div className="text-sm text-gray-400 mb-1">Avg Copier ROI</div>
              <div className={`text-3xl font-bold ${leaderStats?.averageCopierROI >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {leaderStats ? `${(leaderStats.averageCopierROI * 100).toFixed(1)}%` : 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ENS Profile - Shows ENS Integration */}
      <ENSProfileDisplay
        address={address as `0x${string}`}
        ensName={leaderProfile ? (leaderProfile as any)?.ensName || (leaderProfile as any)?.[1] : undefined}
      />

      {/* ENS Metadata - Shows ENS Text Records */}
      {leaderProfile && (leaderProfile as any)?.ensName && (
        <ENSMetadata
          ensName={(leaderProfile as any).ensName || (leaderProfile as any)?.[1]}
          address={address as `0x${string}`}
          demoMode={true}
        />
      )}

      {/* Yellow Network State Channel Dashboard */}
      <YellowStateChannelDashboard leaderAddress={address || ''} />

      {/* Yellow Network Channel Lifecycle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <YellowChannelLifecycle />
        <YellowBatchSettlement />
      </div>

      {/* Trade Execution Panel - Shows Yellow Network */}
      <TradeExecutor leaderAddress={address || ''} />

      {/* Settlement Panel - Shows Uniswap V4 */}
      <SettlementPanel />
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        {icon}
      </div>
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
