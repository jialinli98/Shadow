import { useState, useEffect } from 'react'
import { Users, ChevronDown, ChevronUp } from 'lucide-react'
import { formatEther } from 'viem'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface CompactCopierListProps {
  leaderAddress: string
}

export default function CompactCopierList({ leaderAddress }: CompactCopierListProps) {
  const [copiers, setCopiers] = useState<any[]>([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!leaderAddress) return

    const fetchCopiers = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/copiers/by-leader/${leaderAddress}`)
        setCopiers(response.data)
      } catch (error) {
        console.error('Failed to fetch copiers:', error)
      }
    }

    fetchCopiers()
    const interval = setInterval(fetchCopiers, 10000)
    return () => clearInterval(interval)
  }, [leaderAddress])

  if (copiers.length === 0) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center">
        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
      </div>
    )
  }

  const displayCopiers = showAll ? copiers : copiers.slice(0, 5)

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-white">Active Copiers ({copiers.length})</h2>
        </div>
      </div>

      <div className="space-y-2">
        {displayCopiers.map((copier, index) => (
          <div
            key={index}
            className="flex items-center justify-between bg-gray-700/30 rounded p-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white">
                {copier.copierAddress.slice(2, 4).toUpperCase()}
              </div>
              <span className="font-mono text-sm text-gray-300">
                {copier.copierAddress.slice(0, 6)}...{copier.copierAddress.slice(-4)}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="text-gray-400">
                {formatEther(copier.deposit)} USDC
              </div>
              <div className={`font-semibold ${
                copier.currentPnL >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {copier.currentPnL >= 0 ? '+' : ''}{copier.currentPnL.toFixed(1)}%
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                copier.isActive
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {copier.isActive ? 'Active' : 'Paused'}
              </span>
            </div>
          </div>
        ))}

        {copiers.length > 5 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition flex items-center justify-center gap-1"
          >
            {showAll ? (
              <>Show Less <ChevronUp className="w-4 h-4" /></>
            ) : (
              <>Show All {copiers.length} Copiers <ChevronDown className="w-4 h-4" /></>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
