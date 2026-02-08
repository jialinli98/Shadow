import { useState, useEffect } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { parseEther } from 'viem'
import { Search, AlertTriangle } from 'lucide-react'
import { leaderAPI, copierAPI } from '../services/api'

const REGISTRY_ADDRESS = (import.meta.env.VITE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

interface LeaderStats {
  leaderAddress: string
  totalCopiers: number
  activeCopiers: number
  totalTrades: number
  totalVolume: string
  totalFeesAccumulated: string
  totalFeesSettled: string
  totalFeesClaimable: string
  averageCopierROI: number
  lastUpdated: number
}

interface CopierPortfolio {
  copierAddress: string
  relationships: Array<{
    id: string
    leaderAddress: string
    copierAddress: string
    leaderChannelId: string
    copierChannelId: string
    performanceFeeRate: number
    copierInitialDeposit: string
    maxDrawdown: number
    isActive: boolean
    subscribedAt: number
    lastTradeAt: number | null
    totalFeesAccumulated: string
    totalTradesReplicated: number
    copierTotalPnL: string
    copierCurrentBalance: string
  }>
  totalDeposited: string
  totalCurrentValue: string
  totalPnL: string
  totalFeesOwed: string
  lastUpdated: number
}

export default function CopierDashboard() {
  const { address, isConnected } = useAccount()
  const [searchQuery, setSearchQuery] = useState('')
  const [leaders, setLeaders] = useState<LeaderStats[]>([])
  const [selectedLeader, setSelectedLeader] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState('1000')
  const [maxDrawdown, setMaxDrawdown] = useState(2000) // 20%
  const [portfolio, setPortfolio] = useState<CopierPortfolio | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch copier portfolio
  useEffect(() => {
    if (!address) return

    const fetchPortfolio = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await copierAPI.getPortfolio(address)
        setPortfolio(data)
      } catch (error) {
        // No active subscription
        setPortfolio(null)
        setError(null) // Don't show error if no portfolio exists
      } finally {
        setLoading(false)
      }
    }

    fetchPortfolio()
    const interval = setInterval(fetchPortfolio, 10000) // Update every 10s
    return () => clearInterval(interval)
  }, [address])

  // Fetch available leaders
  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const data = await leaderAPI.getAll()
        setLeaders(data.leaders || [])
      } catch (error) {
        console.error('Failed to fetch leaders:', error)
      }
    }

    fetchLeaders()
    const interval = setInterval(fetchLeaders, 10000) // Update every 10s
    return () => clearInterval(interval)
  }, [])

  // Subscribe to leader
  const { writeContract: subscribeToCopier, isPending: isSubscribing } = useWriteContract()

  const handleSubscribe = async () => {
    if (!selectedLeader || !address) return

    try {
      subscribeToCopier({
        address: REGISTRY_ADDRESS,
        abi: [{
          name: 'subscribeToCopier',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'leader', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'maxDrawdownBps', type: 'uint256' },
          ],
          outputs: [],
        }],
        functionName: 'subscribeToCopier',
        args: [selectedLeader as `0x${string}`, parseEther(depositAmount), BigInt(maxDrawdown)],
      })
    } catch (error) {
      console.error('Subscription failed:', error)
    }
  }

  const filteredLeaders = leaders.filter(leader =>
    leader.leaderAddress.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if copier has active subscriptions
  const hasActiveSubscription = portfolio && portfolio.relationships.length > 0
  const activeRelationship = portfolio?.relationships[0] // For now, show the first one

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to access the Copier Dashboard</p>
      </div>
    )
  }

  if (loading && !portfolio) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">Loading portfolio...</p>
      </div>
    )
  }

  if (hasActiveSubscription && activeRelationship && portfolio) {
    const currentPnL = parseFloat(portfolio.totalPnL) / parseFloat(portfolio.totalDeposited) * 100
    const currentDrawdown = Math.max(0, -currentPnL) // Simple drawdown calculation
    const currentBalance = parseFloat(activeRelationship.copierCurrentBalance) / 1000000 // Convert to USDC

    return (
      <div className="space-y-8">
        <h1 className="text-4xl font-bold text-white">Copier Dashboard</h1>

        {/* Portfolio Summary */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">Your Copy Trading Portfolio</h2>
              <p className="text-sm text-gray-400">Following {portfolio.relationships.length} leader{portfolio.relationships.length > 1 ? 's' : ''}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Total P&L</div>
              <div className={`text-2xl font-bold ${currentPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {currentPnL >= 0 ? '+' : ''}{currentPnL.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatBox
              label="Total Deposited"
              value={`$${(parseFloat(portfolio.totalDeposited) / 1000000).toFixed(2)}M`}
            />
            <StatBox
              label="Current Value"
              value={`$${(parseFloat(portfolio.totalCurrentValue) / 1000000).toFixed(2)}M`}
            />
            <StatBox
              label="Total P&L"
              value={`$${(parseFloat(portfolio.totalPnL) / 1000000).toFixed(2)}M`}
              valueColor={parseFloat(portfolio.totalPnL) >= 0 ? 'text-green-500' : 'text-red-500'}
            />
            <StatBox
              label="Fees Owed"
              value={`$${(parseFloat(portfolio.totalFeesOwed) / 1000000).toFixed(4)}M`}
            />
          </div>
        </div>

        {/* Active Subscriptions */}
        {portfolio.relationships.map((relationship) => (
          <div key={relationship.id} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">
                  Following: {relationship.leaderAddress.slice(0, 6)}...{relationship.leaderAddress.slice(-4)}
                </h3>
                <p className="text-sm text-gray-400 font-mono">{relationship.leaderAddress}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-400">Status</div>
                <span className={`px-3 py-1 text-sm rounded-full ${
                  relationship.isActive
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-red-500/20 text-red-500'
                }`}>
                  {relationship.isActive ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatBox
                label="Your Deposit"
                value={`$${(parseFloat(relationship.copierInitialDeposit) / 1000000).toFixed(2)}M`}
              />
              <StatBox
                label="Current Balance"
                value={`$${(parseFloat(relationship.copierCurrentBalance) / 1000000).toFixed(2)}M`}
              />
              <StatBox
                label="P&L"
                value={`$${(parseFloat(relationship.copierTotalPnL) / 1000000).toFixed(2)}M`}
                valueColor={parseFloat(relationship.copierTotalPnL) >= 0 ? 'text-green-500' : 'text-red-500'}
              />
              <StatBox
                label="Trades Replicated"
                value={relationship.totalTradesReplicated.toString()}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">Performance Fee</div>
                <div className="text-lg text-white">{(relationship.performanceFeeRate * 100).toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-sm text-gray-400 mb-1">Max Drawdown</div>
                <div className="text-lg text-white">{relationship.maxDrawdown.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        ))}

        {/* Info Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">How Copy Trading Works</h3>
          <p className="text-sm text-gray-300">
            All trades happen off-chain in Yellow Network state channels, ensuring your strategy remains private.
            Your trades are automatically replicated when the leader executes, proportional to your deposit size.
            Performance fees are only charged on profits.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-white">Find a Leader to Follow</h1>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by ENS name or address..."
          className="w-full pl-12 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Leaders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredLeaders.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-gray-400">
            No leaders found. Try adjusting your search.
          </div>
        ) : (
          filteredLeaders.map((leader) => (
            <div
              key={leader.leaderAddress}
              className={`bg-gray-800/50 backdrop-blur-sm border rounded-lg p-6 cursor-pointer transition ${
                selectedLeader === leader.leaderAddress
                  ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => setSelectedLeader(leader.leaderAddress)}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-white mb-1">
                    {leader.leaderAddress.slice(0, 6)}...{leader.leaderAddress.slice(-4)}
                  </h3>
                  <p className="text-sm text-gray-400 font-mono">{leader.leaderAddress.slice(0, 10)}...</p>
                </div>
                <div className={`text-2xl font-bold ${leader.averageCopierROI >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {leader.averageCopierROI >= 0 ? '+' : ''}{(leader.averageCopierROI * 100).toFixed(1)}%
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-400">Active Copiers</div>
                  <div className="text-sm text-white font-semibold">{leader.activeCopiers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total Trades</div>
                  <div className="text-sm text-white font-semibold">{leader.totalTrades}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Total Copiers</div>
                  <div className="text-sm text-white font-semibold">{leader.totalCopiers}</div>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                Total Volume: ${(parseFloat(leader.totalVolume) / 1000000).toFixed(2)}M
              </div>
            </div>
          ))
        )}
      </div>

      {/* Subscribe Form */}
      {selectedLeader && (
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-white mb-6">Subscribe to Copy Trading</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Deposit Amount (USDC)
              </label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="1000"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
              />
              <p className="text-sm text-gray-400 mt-1">
                Enter your deposit amount in USDC
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Drawdown: {(maxDrawdown / 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={maxDrawdown}
                onChange={(e) => setMaxDrawdown(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-sm text-gray-400 mt-1">
                Copying will pause if you lose more than this %
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-300">
                  <p className="font-semibold text-white mb-1">Important:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>All trades happen off-chain in Yellow state channels (private)</li>
                    <li>Your trades will be proportionally sized to your deposit</li>
                    <li>Performance fee is charged on profits only</li>
                    <li>You can pause or unsubscribe at any time</li>
                  </ul>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubscribing ? 'Subscribing...' : 'Start Copy Trading'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, valueColor = 'text-white' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${valueColor}`}>{value}</div>
    </div>
  )
}
