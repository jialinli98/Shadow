import { useState, useEffect } from 'react'
import { Radio, Zap, Lock, Unlock, CheckCircle, Clock, DollarSign, Activity } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface StateChannel {
  channelId: string
  status: 'opening' | 'active' | 'settling' | 'closed'
  trades: number
  volume: number
  leaderBalance: number
  copierBalance: number
  openedAt: number
  lastUpdate: number
}

export default function YellowStateChannelDashboard({ leaderAddress }: { leaderAddress: string }) {
  const [channels, setChannels] = useState<StateChannel[]>([])
  const [totalStats, setTotalStats] = useState({
    activeChannels: 0,
    totalTrades: 0,
    totalVolume: 0,
    gassSaved: 0
  })
  const [settlingChannelId, setSettlingChannelId] = useState<string | null>(null)

  // Fetch state channels from API
  useEffect(() => {
    const fetchChannels = async () => {
      if (!leaderAddress) return

      try {
        const response = await axios.get(`${API_URL}/api/state-channels/${leaderAddress}`)
        const fetchedChannels = response.data

        setChannels(fetchedChannels)

        const stats = {
          activeChannels: fetchedChannels.filter((c: StateChannel) => c.status === 'active').length,
          totalTrades: fetchedChannels.reduce((sum: number, c: StateChannel) => sum + c.trades, 0),
          totalVolume: fetchedChannels.reduce((sum: number, c: StateChannel) => sum + c.volume, 0),
          gassSaved: fetchedChannels.reduce((sum: number, c: StateChannel) => sum + c.trades, 0) * 15
        }

        setTotalStats(stats)
      } catch (error) {
        console.error('Failed to fetch state channels:', error)
      }
    }

    fetchChannels()

    // Poll for updates every 3 seconds
    const interval = setInterval(fetchChannels, 3000)
    return () => clearInterval(interval)
  }, [leaderAddress])

  const getStatusColor = (status: StateChannel['status']) => {
    switch (status) {
      case 'opening': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
      case 'active': return 'text-green-400 bg-green-500/20 border-green-500/30'
      case 'settling': return 'text-blue-400 bg-blue-500/20 border-blue-500/30'
      case 'closed': return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  const getStatusIcon = (status: StateChannel['status']) => {
    switch (status) {
      case 'opening': return <Clock className="w-4 h-4" />
      case 'active': return <Zap className="w-4 h-4" />
      case 'settling': return <Lock className="w-4 h-4" />
      case 'closed': return <CheckCircle className="w-4 h-4" />
    }
  }

  const formatTime = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  const handleSettleChannel = async (channelId: string) => {
    setSettlingChannelId(channelId)
    try {
      await axios.post(`${API_URL}/api/state-channels/${channelId}/settle`)
      // Channel will update via polling
    } catch (error) {
      console.error('Failed to settle channel:', error)
    } finally {
      setTimeout(() => setSettlingChannelId(null), 3000)
    }
  }

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white flex items-center">
          <Radio className="w-6 h-6 mr-2 text-indigo-500" />
          Yellow Network State Channels
        </h2>
        <div className="text-xs text-gray-400 font-mono">ERC-7824 Nitrolite</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-400">Active Channels</span>
          </div>
          <div className="text-2xl font-bold text-white">{totalStats.activeChannels}</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-400">Total Trades</span>
          </div>
          <div className="text-2xl font-bold text-white">{totalStats.totalTrades}</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-400">Total Volume</span>
          </div>
          <div className="text-2xl font-bold text-white">${(totalStats.totalVolume / 1000).toFixed(0)}k</div>
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-green-600/5 rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center space-x-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-400">Gas Saved</span>
          </div>
          <div className="text-2xl font-bold text-green-400">${totalStats.gassSaved.toLocaleString()}</div>
        </div>
      </div>

      {/* Channel List */}
      <div className="space-y-3">
        {channels.map((channel) => (
          <div
            key={channel.channelId}
            className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-indigo-500/50 transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 border ${getStatusColor(channel.status)}`}>
                    {getStatusIcon(channel.status)}
                    <span className="uppercase">{channel.status}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    Opened {formatTime(channel.openedAt)}
                  </span>
                </div>
                <div className="text-xs font-mono text-gray-400 break-all">
                  Channel ID: {channel.channelId}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-gray-400 text-xs mb-1">Trades</div>
                <div className="text-white font-semibold">{channel.trades}</div>
                <div className="text-xs text-gray-500">
                  {channel.status === 'active' ? 'Off-chain' : 'Ready to settle'}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Volume</div>
                <div className="text-white font-semibold">${(channel.volume / 1000).toFixed(1)}k</div>
                <div className="text-xs text-gray-500">
                  ~${((channel.trades * 15) / 1000).toFixed(1)}k gas saved
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Leader Balance</div>
                <div className="text-green-400 font-semibold">${(channel.leaderBalance / 1000).toFixed(1)}k</div>
                <div className="text-xs text-gray-500">
                  {channel.status === 'settling' ? 'Settling...' : 'Live'}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs mb-1">Copier Balance</div>
                <div className="text-blue-400 font-semibold">${(channel.copierBalance / 1000).toFixed(1)}k</div>
                <div className="text-xs text-gray-500">
                  {channel.status === 'settling' ? 'Settling...' : 'Live'}
                </div>
              </div>
            </div>

            {/* Settle Button */}
            {channel.status === 'active' && channel.trades > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <button
                  onClick={() => handleSettleChannel(channel.channelId)}
                  disabled={settlingChannelId === channel.channelId}
                  className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-sm font-semibold rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {settlingChannelId === channel.channelId ? (
                    <>
                      <Lock className="w-4 h-4 animate-spin" />
                      <span>Settling Channel...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Settle Channel via Uniswap V4</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {channel.status === 'settling' && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="flex items-center space-x-2 text-xs text-blue-400">
                  <Lock className="w-3 h-3 animate-pulse" />
                  <span>Generating state proof for Uniswap V4 settlement...</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Yellow Network Explanation */}
      <div className="mt-6 bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Radio className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-white mb-2">Yellow Network (ERC-7824) Integration</p>
            <ul className="space-y-1 text-xs">
              <li>✅ <strong>Off-chain Execution:</strong> All {totalStats.totalTrades} trades executed without touching blockchain</li>
              <li>✅ <strong>State Channels:</strong> {totalStats.activeChannels} active channels with real-time balance updates</li>
              <li>✅ <strong>Gas Savings:</strong> ${totalStats.gassSaved.toLocaleString()} saved (${totalStats.totalTrades} transactions avoided)</li>
              <li>✅ <strong>Privacy:</strong> Only final settlement visible on-chain, individual trades private</li>
              <li>✅ <strong>Instant Settlement:</strong> Trades settle instantly in state channels, no waiting for blocks</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
