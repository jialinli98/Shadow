import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Users, DollarSign, Filter, ChevronDown } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface LeaderStats {
  address: string
  ensName: string
  performanceFee: number
  minDeposit: string
  totalCopiers: number
  totalVolume: string
  feesEarned: string
  roi: number
  maxDrawdown: number
  winRate: number
  totalTrades: number
  avgTradeSize: string
  isActive: boolean
}

type SortField = 'roi' | 'totalCopiers' | 'totalVolume' | 'winRate'
type SortOrder = 'asc' | 'desc'

export default function Leaderboard() {
  const navigate = useNavigate()
  const [leaders, setLeaders] = useState<LeaderStats[]>([])
  const [sortField, setSortField] = useState<SortField>('roi')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [minROI, setMinROI] = useState(-100)
  const [maxFee, setMaxFee] = useState(3000)
  const [showFilters, setShowFilters] = useState(false)

  // Fetch leaders from API
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
    const interval = setInterval(fetchLeaders, 10000) // Update every 10s
    return () => clearInterval(interval)
  }, [])

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
    leader.roi >= minROI && leader.performanceFee <= maxFee && leader.isActive
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
          value={filteredLeaders.reduce((sum, l) => sum + l.totalCopiers, 0).toString()}
          icon={<Users className="w-5 h-5 text-purple-500" />}
        />
        <SummaryCard
          label="Total Volume"
          value={`$${(filteredLeaders.reduce((sum, l) => sum + parseFloat(l.totalVolume), 0) / 1000000).toFixed(2)}M`}
          icon={<DollarSign className="w-5 h-5 text-green-500" />}
        />
        <SummaryCard
          label="Avg ROI"
          value={`${(filteredLeaders.reduce((sum, l) => sum + l.roi, 0) / filteredLeaders.length || 0).toFixed(1)}%`}
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
                  onClick={() => handleSort('roi')}
                >
                  <div className="flex items-center space-x-1">
                    <span>ROI</span>
                    {sortField === 'roi' && (
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
                  onClick={() => handleSort('totalVolume')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Volume</span>
                    {sortField === 'totalVolume' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white transition"
                  onClick={() => handleSort('winRate')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Win Rate</span>
                    {sortField === 'winRate' && (
                      sortOrder === 'desc' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Fee
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Min Deposit
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filteredLeaders.map((leader, index) => (
                <tr key={leader.address} className="hover:bg-gray-700/30 transition">
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
                        <div className="text-sm font-semibold text-white">{leader.ensName}</div>
                        <div className="text-xs text-gray-400 font-mono">{leader.address.slice(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-bold ${leader.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {leader.roi >= 0 ? '+' : ''}{leader.roi.toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-400">Max DD: {leader.maxDrawdown.toFixed(1)}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white font-semibold">{leader.totalCopiers}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">${(parseFloat(leader.totalVolume) / 1000).toFixed(1)}K</div>
                    <div className="text-xs text-gray-400">{leader.totalTrades} trades</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white font-semibold">{leader.winRate.toFixed(1)}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">{(leader.performanceFee / 100).toFixed(1)}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">${leader.minDeposit}</div>
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

        {filteredLeaders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No leaders found matching your filters</p>
          </div>
        )}
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
