import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Users, DollarSign, Filter, ChevronDown } from 'lucide-react'
import { leaderAPI } from '../services/api'
import { useLeaderUpdates } from '../hooks/useSocket'

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

type SortField = 'averageCopierROI' | 'totalCopiers' | 'totalVolume' | 'totalTrades'
type SortOrder = 'asc' | 'desc'

export default function Leaderboard() {
  const navigate = useNavigate()
  const [leaders, setLeaders] = useState<LeaderStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('averageCopierROI')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [minROI, setMinROI] = useState(-100)
  const [maxFee, setMaxFee] = useState(50) // 50% max
  const [showFilters, setShowFilters] = useState(false)

  // Real-time updates for new leaders
  const newLeaders = useLeaderUpdates()

  // Fetch leaders from API
  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await leaderAPI.getAll()
        setLeaders(data.leaders || [])
      } catch (err) {
        console.error('Failed to fetch leaders:', err)
        setError('Failed to load leaders')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaders()
    const interval = setInterval(fetchLeaders, 10000) // Update every 10s
    return () => clearInterval(interval)
  }, [])

  // Refetch when new leaders are registered
  useEffect(() => {
    if (newLeaders.length > 0) {
      leaderAPI.getAll().then(data => setLeaders(data.leaders || []))
    }
  }, [newLeaders])

  // Sort leaders
  const sortedLeaders = [...leaders].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const aNum = parseFloat(aValue)
      const bNum = parseFloat(bValue)
      return sortOrder === 'desc' ? bNum - aNum : aNum - bNum
    }

    return sortOrder === 'desc' ? Number(bValue) - Number(aValue) : Number(aValue) - Number(bValue)
  })

  // Filter leaders
  const filteredLeaders = sortedLeaders.filter(leader =>
    leader.averageCopierROI * 100 >= minROI && leader.activeCopiers > 0
  )

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Leaderboard</h1>
          <p className="text-gray-400">Discover top-performing traders on Shadow</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Filter Leaders</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Minimum ROI: {minROI}%
              </label>
              <input
                type="range"
                min="-100"
                max="500"
                step="10"
                value={minROI}
                onChange={(e) => setMinROI(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Performance Fee: {(maxFee / 100).toFixed(1)}%
              </label>
              <input
                type="range"
                min="0"
                max="3000"
                step="100"
                value={maxFee}
                onChange={(e) => setMaxFee(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Leaders"
          value={filteredLeaders.length.toString()}
          icon={<Users className="w-5 h-5 text-indigo-500" />}
        />
        <SummaryCard
          label="Total Copiers"
          value={filteredLeaders.reduce((sum, l) => sum + l.activeCopiers, 0).toString()}
          icon={<Users className="w-5 h-5 text-purple-500" />}
        />
        <SummaryCard
          label="Total Volume"
          value={`$${(filteredLeaders.reduce((sum, l) => sum + parseFloat(l.totalVolume), 0) / 1000000).toFixed(2)}M`}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
        />
        <SummaryCard
          label="Avg ROI"
          value={`${(filteredLeaders.reduce((sum, l) => sum + l.averageCopierROI * 100, 0) / filteredLeaders.length || 0).toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
        />
      </div>

      {/* Leaders Table */}
      <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Leader
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('averageCopierROI')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Avg ROI</span>
                    {sortField === 'averageCopierROI' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('totalCopiers')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Copiers</span>
                    {sortField === 'totalCopiers' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('totalTrades')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Trades</span>
                    {sortField === 'totalTrades' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('totalVolume')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Volume</span>
                    {sortField === 'totalVolume' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Fees Earned
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                    Loading leaders...
                  </td>
                </tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-red-400">
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredLeaders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400">
                    No leaders found. Be the first to register!
                  </td>
                </tr>
              )}
              {!loading && filteredLeaders.map((leader, index) => (
                <tr key={leader.leaderAddress} className="hover:bg-gray-700/30 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {index < 3 ? (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-500 text-gray-900' :
                          index === 1 ? 'bg-gray-400 text-gray-900' :
                          'bg-orange-600 text-white'
                        }`}>
                          {index + 1}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-gray-300 text-sm">
                          {index + 1}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {leader.leaderAddress.slice(0, 6)}...{leader.leaderAddress.slice(-4)}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">{leader.leaderAddress.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-bold ${leader.averageCopierROI >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {leader.averageCopierROI >= 0 ? '+' : ''}{(leader.averageCopierROI * 100).toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white font-semibold">{leader.activeCopiers}</div>
                    <div className="text-xs text-gray-400">of {leader.totalCopiers} total</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white font-semibold">{leader.totalTrades}</div>
                    <div className="text-xs text-gray-400">trades</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">${(parseFloat(leader.totalVolume) / 1000000).toFixed(2)}M</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">${(parseFloat(leader.totalFeesAccumulated) / 1000000).toFixed(2)}M</div>
                    <div className="text-xs text-gray-400">Claimable: ${(parseFloat(leader.totalFeesClaimable) / 1000000).toFixed(2)}M</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => navigate('/copier')}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition"
                    >
                      Follow
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-2">How Rankings Work</h3>
        <p className="text-sm text-gray-300">
          Leaders are ranked by ROI (Return on Investment) by default. All trades happen off-chain in Yellow Network state channels,
          ensuring your strategy remains private. Click on any column header to sort by that metric. Use filters to find leaders
          that match your risk tolerance and fee preferences.
        </p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
