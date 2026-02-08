import { useState, useEffect } from 'react'
import { Lock, ChevronDown, ChevronUp, Activity, TrendingUp, TrendingDown } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Session {
  channelId: string
  status: 'opening' | 'active' | 'trading' | 'settling' | 'closed'
  trades: number
  volume: number
  leaderBalance: number
  copierBalance: number
  openedAt: number
}

interface Trade {
  tradeId: string
  timestamp: number
  asset: string
  side: 'BUY' | 'SELL'
  amount: string
  price: string
  role: 'leader' | 'copier'
  channelId: string
}

interface TradingSessionsProps {
  leaderAddress: string
}

export default function TradingSessions({ leaderAddress }: TradingSessionsProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [showDetails, setShowDetails] = useState(false)
  const [stats, setStats] = useState({
    activeSessions: 0,
    totalTrades: 0,
    totalVolume: 0,
    gasSaved: 0
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!leaderAddress) return

      try {
        // Fetch sessions
        const sessionsResponse = await axios.get(`${API_URL}/api/state-channels/${leaderAddress}`)
        const fetchedSessions = sessionsResponse.data

        setSessions(fetchedSessions)

        const calculatedStats = {
          activeSessions: fetchedSessions.filter((s: Session) => s.status === 'active' || s.status === 'trading').length,
          totalTrades: fetchedSessions.reduce((sum: number, s: Session) => sum + s.trades, 0),
          totalVolume: fetchedSessions.reduce((sum: number, s: Session) => sum + s.volume, 0),
          gasSaved: fetchedSessions.reduce((sum: number, s: Session) => sum + s.trades, 0) * 15
        }

        setStats(calculatedStats)

        // Fetch individual trades
        const tradesResponse = await axios.get(`${API_URL}/api/trades/${leaderAddress}`)
        setTrades(tradesResponse.data.trades || [])
      } catch (error) {
        console.error('Failed to fetch data:', error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [leaderAddress])

  const getStatusColor = (status: Session['status']) => {
    switch (status) {
      case 'active':
      case 'trading':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'settling':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'opening':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  const formatTime = (timestamp: number) => {
    const minutes = Math.floor((Date.now() - timestamp) / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-500" />
            Active Trading Sessions
          </h2>
          <p className="text-sm text-gray-400">Off-chain execution for privacy and efficiency</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-purple-400">{stats.activeSessions}</div>
          <div className="text-xs text-gray-400">Active</div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Total Trades</div>
          <div className="text-xl font-bold text-white">{stats.totalTrades}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Volume</div>
          <div className="text-xl font-bold text-white">${(stats.totalVolume / 1000).toFixed(0)}k</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Gas Saved</div>
          <div className="text-xl font-bold text-green-400">${stats.gasSaved.toLocaleString()}</div>
        </div>
      </div>

      {/* Session List */}
      {sessions.length > 0 ? (
        <div className="space-y-3">
          {sessions.slice(0, showDetails ? sessions.length : 3).map((session) => (
            <div
              key={session.channelId}
              className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-gray-400">
                    #{session.channelId.slice(2, 10)}
                  </span>
                  <span className={`px-2 py-0.5 text-xs rounded border ${getStatusColor(session.status)}`}>
                    {session.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{formatTime(session.openedAt)}</div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-300">
                  <span className="font-semibold">{session.trades}</span> trades
                  <span className="text-gray-500 mx-2">•</span>
                  <span className="font-semibold">${(session.volume / 1000).toFixed(1)}k</span> volume
                </div>
                <div className="text-xs text-gray-500">
                  Balances: ${(session.leaderBalance / 1000).toFixed(0)}k / ${(session.copierBalance / 1000).toFixed(0)}k
                </div>
              </div>
            </div>
          ))}

          {sessions.length > 3 && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full py-2 text-sm text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1"
            >
              {showDetails ? (
                <>
                  Show Less <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Show All {sessions.length} Sessions <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <Lock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No active sessions yet</p>
        </div>
      )}

      {/* Recent Trades */}
      {trades.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-white mb-3">Recent Trades</h3>
          <div className="space-y-2">
            {trades.slice(0, 5).map((trade) => (
              <div
                key={trade.tradeId}
                className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {trade.side === 'BUY' ? (
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-400" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-white">
                      {trade.side} {trade.amount} {trade.asset}
                    </div>
                    <div className="text-xs text-gray-400">
                      @ ${parseFloat(trade.price).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {trade.role === 'leader' ? 'Leader' : 'Following'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-800/50 rounded p-3 mt-4">
        <Lock className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-gray-300">Privacy guaranteed</span> • All trades execute off-chain with zero mempool exposure
        </div>
      </div>
    </div>
  )
}
