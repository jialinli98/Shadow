import { useState, useEffect } from 'react'
import { Search, TrendingUp, Users, ExternalLink, X, CheckCircle } from 'lucide-react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { parseEther } from 'viem'
import { normalize } from 'viem/ens'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const REGISTRY_ADDRESS = (import.meta.env.VITE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

interface Leader {
  address: string
  ensName?: string
  winRate: number
  roi: number
  totalTrades: number
  copiers: number
  performanceFee: number
}

export default function BrowseLeaders() {
  const { isConnected } = useAccount()
  const publicClient = usePublicClient()
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedLeader, setSelectedLeader] = useState<Leader | null>(null)
  const [showCopyModal, setShowCopyModal] = useState(false)

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        // Fetch real leaders from API
        const response = await axios.get(`${API_URL}/api/leaders`)
        console.log('Fetched leaders from API:', response.data)

        const leadersData = response.data.leaders || response.data || []

        // Map API response to Leader interface
        const mappedLeaders = leadersData.map((leader: any) => ({
          address: leader.address || leader.leaderAddress,
          ensName: leader.ensName,
          winRate: leader.winRate || 0,
          roi: leader.roi || 0,
          totalTrades: leader.totalTrades || 0,
          copiers: leader.activeCopiers || leader.copierCount || 0,
          performanceFee: leader.performanceFee || leader.fee || 15
        }))

        setLeaders(mappedLeaders)
        setLoading(false)
      } catch (error) {
        console.error('Failed to fetch leaders:', error)
        setLeaders([])
        setLoading(false)
      }
    }

    fetchLeaders()
  }, [publicClient])

  const filteredLeaders = leaders.filter(leader =>
    leader.ensName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    leader.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCopyLeader = (leader: Leader) => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }
    setSelectedLeader(leader)
    setShowCopyModal(true)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Copy Modal */}
      {showCopyModal && selectedLeader && (
        <CopyLeaderModal
          leader={selectedLeader}
          onClose={() => {
            setShowCopyModal(false)
            setSelectedLeader(null)
          }}
        />
      )}
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Browse Leaders</h1>
        <p className="text-gray-400">Find successful traders to copy</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by ENS name or address..."
          className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Leaders Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading leaders...</div>
      ) : filteredLeaders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No leaders found</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeaders.map((leader) => (
            <LeaderCard
              key={leader.address}
              leader={leader}
              onCopy={() => handleCopyLeader(leader)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LeaderCard({ leader, onCopy }: { leader: Leader; onCopy: () => void }) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6 hover:border-indigo-500/50 transition">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white">
            {leader.ensName ? leader.ensName[0].toUpperCase() : leader.address.slice(2, 4).toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-white flex items-center gap-2">
              {leader.ensName || `${leader.address.slice(0, 6)}...${leader.address.slice(-4)}`}
              {leader.ensName && (
                <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30 flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" />
                  ENS
                </span>
              )}
            </div>
            {leader.ensName && (
              <div className="text-xs text-gray-400 font-mono">
                {leader.address.slice(0, 6)}...{leader.address.slice(-4)}
              </div>
            )}
          </div>
        </div>
        {leader.ensName && (
          <a
            href={`https://app.ens.domains/${leader.ensName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-indigo-400 transition"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-700/30 rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Win Rate</div>
          <div className="text-lg font-bold text-green-400">{leader.winRate}%</div>
        </div>
        <div className="bg-gray-700/30 rounded p-3">
          <div className="text-xs text-gray-400 mb-1">Total ROI</div>
          <div className="text-lg font-bold text-purple-400">+{leader.roi}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span>{leader.totalTrades} trades</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Users className="w-4 h-4 text-indigo-400" />
          <span>{leader.copiers} copiers</span>
        </div>
      </div>

      {/* Performance Fee */}
      <div className="text-xs text-gray-400 mb-4">
        Performance fee: <span className="text-white font-semibold">{leader.performanceFee}%</span>
      </div>

      {/* Action Button */}
      <button
        onClick={onCopy}
        className="w-full py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition"
      >
        Copy This Leader
      </button>
    </div>
  )
}

function CopyLeaderModal({ leader, onClose }: { leader: Leader; onClose: () => void }) {
  const { address: userAddress, isConnected } = useAccount()
  const [depositAmount, setDepositAmount] = useState('1000')
  const [maxDrawdown, setMaxDrawdown] = useState('20')
  const [error, setError] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [success, setSuccess] = useState(false)


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    console.log('Starting copy leader flow...')
    console.log('User address:', userAddress)
    console.log('Leader address:', leader.address)
    console.log('Deposit:', depositAmount)
    console.log('Max drawdown:', maxDrawdown)

    if (!isConnected || !userAddress) {
      setError('Please connect your wallet first')
      return
    }

    setSubscribing(true)

    try {
      // Step 1: Open Yellow Network session for copier
      console.log('Step 1: Opening Yellow Network session...')
      const collateralUsdc = BigInt(depositAmount) * BigInt(1000000) // Convert to USDC (6 decimals)

      const sessionResponse = await axios.post(`${API_URL}/api/sessions/open`, {
        userAddress,
        collateral: collateralUsdc.toString(),
      })

      const copierChannelId = sessionResponse.data.channelId
      console.log('✅ Session opened:', copierChannelId)

      // Step 2: Subscribe copier to leader
      console.log('Step 2: Subscribing to leader...')
      const subscribeResponse = await axios.post(`${API_URL}/api/copiers/subscribe`, {
        copierAddress: userAddress,
        leaderAddress: leader.address,
        copierChannelId,
        performanceFee: leader.performanceFee / 100, // Convert from percentage
        maxDrawdown: parseInt(maxDrawdown),
      })

      console.log('✅ Subscribed successfully:', subscribeResponse.data)
      setSuccess(true)

      setTimeout(() => {
        onClose()
        window.location.href = '/dashboard'
      }, 2000)
    } catch (error: any) {
      console.error('Failed to subscribe:', error)
      setError(error.response?.data?.error || error.message || 'Subscription failed')
      setSubscribing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Copy Leader</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Leader Info */}
        <div className="bg-gray-700/30 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white">
              {leader.ensName ? leader.ensName[0].toUpperCase() : leader.address.slice(2, 4).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-white text-lg">
                {leader.ensName || `${leader.address.slice(0, 6)}...${leader.address.slice(-4)}`}
              </div>
              <div className="text-sm text-gray-400">
                {leader.winRate}% win • +{leader.roi}% ROI • {leader.performanceFee}% fee
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Deposit Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                min="100"
                step="100"
                required
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-lg focus:border-indigo-500 focus:outline-none"
                placeholder="1000"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">USDC</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stop Loss: {maxDrawdown}%
            </label>
            <input
              type="range"
              value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(e.target.value)}
              min="5"
              max="50"
              step="5"
              className="w-full"
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={subscribing || success}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {subscribing ? 'Subscribing...' : success ? '✓ Done' : 'Start Copying'}
            </button>
          </div>
        </form>

        {success && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-400">
            ✓ Successfully started copying {leader.ensName || 'this leader'}!
          </div>
        )}
      </div>
    </div>
  )
}
