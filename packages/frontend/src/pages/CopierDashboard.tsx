import { useState, useEffect } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { Search, TrendingUp, TrendingDown, Shield, AlertTriangle } from 'lucide-react'
import axios from 'axios'

const REGISTRY_ADDRESS = (import.meta.env.VITE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Leader {
  address: string
  ensName: string
  performanceFee: number
  minDeposit: string
  totalCopiers: number
  totalVolume: string
  roi: number
}

export default function CopierDashboard() {
  const { address, isConnected } = useAccount()
  const [searchQuery, setSearchQuery] = useState('')
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [selectedLeader, setSelectedLeader] = useState<string | null>(null)
  const [depositAmount, setDepositAmount] = useState('1000')
  const [maxDrawdown, setMaxDrawdown] = useState(2000) // 20%
  const [activeSubscription, setActiveSubscription] = useState<any>(null)

  // Check if copier has active subscription
  useEffect(() => {
    if (!address) return

    const fetchSubscription = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/copiers/${address}`)
        setActiveSubscription(response.data)
      } catch (error) {
        // No active subscription
        setActiveSubscription(null)
      }
    }

    fetchSubscription()
  }, [address])

  // Fetch available leaders
  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/leaders`)
        setLeaders(response.data)
      } catch (error) {
        console.error('Failed to fetch leaders:', error)
      }
    }

    fetchLeaders()
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
    leader.ensName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    leader.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isConnected) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h2>
        <p className="text-gray-400">Please connect your wallet to access the Copier Dashboard</p>
      </div>
    )
  }

  if (activeSubscription) {
    return (
      <div className="space-y-8">
        <h1 className="text-4xl font-bold text-white">Copier Dashboard</h1>

        {/* Active Subscription */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">Following: {activeSubscription.leaderEns}</h2>
              <p className="text-sm text-gray-400 font-mono">{activeSubscription.leaderAddress}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Status</div>
              <span className={`px-3 py-1 text-sm rounded-full ${
                activeSubscription.isActive
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-red-500/20 text-red-500'
              }`}>
                {activeSubscription.isActive ? 'Active' : 'Paused'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatBox
              label="Your Deposit"
              value={`${formatEther(activeSubscription.deposit)} USDC`}
            />
            <StatBox
              label="Current P&L"
              value={`${activeSubscription.currentPnL >= 0 ? '+' : ''}${activeSubscription.currentPnL.toFixed(2)}%`}
              valueColor={activeSubscription.currentPnL >= 0 ? 'text-green-500' : 'text-red-500'}
            />
            <StatBox
              label="Max Drawdown"
              value={`${activeSubscription.maxDrawdown / 100}%`}
            />
            <StatBox
              label="Current Drawdown"
              value={`${activeSubscription.currentDrawdown.toFixed(2)}%`}
              valueColor={activeSubscription.currentDrawdown > activeSubscription.maxDrawdown / 100 ? 'text-red-500' : 'text-gray-300'}
            />
          </div>
        </div>

        {/* Risk Status */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-indigo-500" />
            Risk Status
          </h3>

          <div className="space-y-3">
            <RiskIndicator
              label="Position Size"
              current={activeSubscription.currentPositionSize}
              max={activeSubscription.maxPositionSize}
              unit="USDC"
            />
            <RiskIndicator
              label="Daily Drawdown"
              current={activeSubscription.dailyDrawdown}
              max={activeSubscription.maxDailyDrawdown}
              unit="%"
              warning={activeSubscription.dailyDrawdown > activeSubscription.maxDailyDrawdown * 0.8}
            />
            <RiskIndicator
              label="Open Positions"
              current={activeSubscription.openPositions}
              max={activeSubscription.maxOpenPositions}
              unit="positions"
            />
          </div>
        </div>

        {/* Recent Trades */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Recent Replicated Trades</h3>

          {activeSubscription.recentTrades?.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No trades yet</p>
          ) : (
            <div className="space-y-3">
              {activeSubscription.recentTrades?.map((trade: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                  <div className="flex items-center space-x-4">
                    {trade.side === 'BUY' ? (
                      <TrendingUp className="w-5 h-5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <div className="text-white font-semibold">{trade.side} {trade.asset}</div>
                      <div className="text-sm text-gray-400">
                        {formatEther(trade.amount)} @ ${trade.price}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-400">{new Date(trade.timestamp).toLocaleString()}</div>
                    <div className={`text-sm font-semibold ${trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-4">
          <button className="px-6 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition">
            Pause Copying
          </button>
          <button className="px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition">
            Unsubscribe & Withdraw
          </button>
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
        {filteredLeaders.map((leader) => (
          <div
            key={leader.address}
            className={`bg-gray-800/50 backdrop-blur-sm border rounded-lg p-6 cursor-pointer transition ${
              selectedLeader === leader.address
                ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => setSelectedLeader(leader.address)}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">{leader.ensName}</h3>
                <p className="text-sm text-gray-400 font-mono">{leader.address.slice(0, 10)}...</p>
              </div>
              <div className={`text-2xl font-bold ${leader.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {leader.roi >= 0 ? '+' : ''}{leader.roi}%
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs text-gray-400">Fee</div>
                <div className="text-sm text-white font-semibold">{leader.performanceFee / 100}%</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Min Deposit</div>
                <div className="text-sm text-white font-semibold">{leader.minDeposit} USDC</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Copiers</div>
                <div className="text-sm text-white font-semibold">{leader.totalCopiers}</div>
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Total Volume: {Number(leader.totalVolume).toFixed(2)} USDC
            </div>
          </div>
        ))}
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
                Minimum: {leaders.find(l => l.address === selectedLeader)?.minDeposit} USDC
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

function RiskIndicator({ label, current, max, unit, warning = false }: {
  label: string
  current: number
  max: number
  unit: string
  warning?: boolean
}) {
  const percentage = (current / max) * 100

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-300">{label}</span>
        <span className={`text-sm font-semibold ${warning ? 'text-yellow-500' : 'text-gray-300'}`}>
          {current} / {max} {unit}
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            percentage > 80 ? 'bg-red-500' : percentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
          }`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  )
}
