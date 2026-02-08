import { useState, useEffect } from 'react'
import { Activity, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface Session {
  channelId: string
  status: string
  trades: number
  volume: number
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

interface CompactSessionsProps {
  leaderAddress: string
}

export default function CompactSessions({ leaderAddress }: CompactSessionsProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [showAll, setShowAll] = useState(false)
  const [stats, setStats] = useState({
    active: 0,
    totalTrades: 0,
    gasSaved: 0
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!leaderAddress) return

      try {
        // Fetch sessions
        const sessionsResponse = await axios.get(`${API_URL}/api/state-channels/${leaderAddress}`)
        const sessionsData = sessionsResponse.data

        setSessions(sessionsData)
        setStats({
          active: sessionsData.filter((s: Session) => s.status === 'active' || s.status === 'trading').length,
          totalTrades: sessionsData.reduce((sum: number, s: Session) => sum + s.trades, 0),
          gasSaved: sessionsData.reduce((sum: number, s: Session) => sum + s.trades, 0) * 15
        })

        // Fetch individual trades
        const tradesResponse = await axios.get(`${API_URL}/api/trades/${leaderAddress}`)
        setTrades(tradesResponse.data.trades || [])
      } catch (error) {
        console.error('Failed to fetch data:', error)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [leaderAddress])

  const displaySessions = showAll ? sessions : sessions.slice(0, 3)

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-white">Trading Sessions</h2>
        </div>
        <div className="text-sm text-gray-400">
          {stats.active} active • {stats.totalTrades} trades • ${stats.gasSaved} saved
        </div>
      </div>

      {displaySessions.length > 0 ? (
        <div className="space-y-2">
          {displaySessions.map((session) => (
            <div
              key={session.channelId}
              className="flex items-center justify-between bg-gray-800/50 rounded p-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-gray-400">#{session.channelId.slice(2, 8)}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  session.status === 'active' || session.status === 'trading'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}>
                  {session.status.toUpperCase()}
                </span>
              </div>
              <div className="text-gray-400">
                {session.trades} trades • ${(session.volume / 1000).toFixed(0)}k
              </div>
            </div>
          ))}

          {sessions.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 text-sm text-purple-400 hover:text-purple-300 transition flex items-center justify-center gap-1"
            >
              {showAll ? (
                <>Show Less <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Show All {sessions.length} Sessions <ChevronDown className="w-4 h-4" /></>
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500">
          No active sessions
        </div>
      )}

      {/* Recent Trades */}
      {trades.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/50">
          <h3 className="text-sm font-semibold text-white mb-2">Recent Trades</h3>
          <div className="space-y-2">
            {trades.slice(0, 3).map((trade) => (
              <div
                key={trade.tradeId}
                className="bg-gray-800/30 rounded p-2 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  {trade.side === 'BUY' ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                  <div>
                    <div className="text-white font-medium">
                      {trade.side} {parseFloat(trade.amount).toFixed(6)} {trade.asset}
                    </div>
                    <div className="text-gray-500">
                      @ ${parseFloat(trade.price).toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-gray-400">
                    {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-gray-500">
                    {trade.role === 'leader' ? 'Leader' : 'Copied'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-xs text-gray-500">
        Off-chain state channels for privacy and gas efficiency
      </div>
    </div>
  )
}
