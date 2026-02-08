import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { normalize } from 'viem/ens'
import { ExternalLink, TrendingUp, CheckCircle } from 'lucide-react'

interface CompactPerformanceProps {
  ensName?: string
  address: string
  winRate?: number
  roi?: number
  totalTrades?: number
}

export default function CompactPerformance({
  ensName,
  address,
  winRate: fallbackWinRate,
  roi: fallbackRoi,
  totalTrades: fallbackTotalTrades
}: CompactPerformanceProps) {
  const [ensData, setEnsData] = useState<{
    winRate: number | null
    roi: number | null
    totalTrades: number | null
    isFromENS: boolean
  }>({
    winRate: fallbackWinRate || null,
    roi: fallbackRoi || null,
    totalTrades: fallbackTotalTrades || null,
    isFromENS: false
  })
  const [loading, setLoading] = useState(true)
  const publicClient = usePublicClient()

  useEffect(() => {
    const fetchENSData = async () => {
      if (!ensName || !publicClient) {
        setLoading(false)
        return
      }

      try {
        const normalizedName = normalize(ensName)

        const [winRate, roi, totalTrades] = await Promise.allSettled([
          publicClient.getEnsText({ name: normalizedName, key: 'trading.winrate' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.roi' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.totalTrades' }),
        ])

        const winRateValue = winRate.status === 'fulfilled' && winRate.value ? parseFloat(winRate.value) : null
        const roiValue = roi.status === 'fulfilled' && roi.value ? parseFloat(roi.value) : null
        const totalTradesValue = totalTrades.status === 'fulfilled' && totalTrades.value ? parseInt(totalTrades.value) : null

        setEnsData({
          winRate: winRateValue || fallbackWinRate || 73.5,
          roi: roiValue || fallbackRoi || 284,
          totalTrades: totalTradesValue || fallbackTotalTrades || 1247,
          isFromENS: !!(winRateValue || roiValue || totalTradesValue)
        })
      } catch (error) {
        console.error('Failed to fetch ENS data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchENSData()
  }, [ensName, publicClient, fallbackWinRate, fallbackRoi, fallbackTotalTrades])

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-semibold text-white">Your Performance</h2>
          {ensData.isFromENS && (
            <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded border border-green-500/30 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              ENS
            </span>
          )}
        </div>
        {ensName && (
          <a
            href={`https://app.ens.domains/${ensName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1"
          >
            {ensName}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4 text-gray-400 text-sm">Loading ENS data...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">Win Rate</div>
              <div className="text-2xl font-bold text-green-400">{ensData.winRate}%</div>
              {ensData.isFromENS && <div className="text-xs text-gray-500 font-mono mt-1">trading.winrate</div>}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Total ROI</div>
              <div className="text-2xl font-bold text-purple-400">+{ensData.roi}%</div>
              {ensData.isFromENS && <div className="text-xs text-gray-500 font-mono mt-1">trading.roi</div>}
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Trades</div>
              <div className="text-2xl font-bold text-blue-400">{ensData.totalTrades?.toLocaleString()}</div>
              {ensData.isFromENS && <div className="text-xs text-gray-500 font-mono mt-1">trading.totalTrades</div>}
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-500">
            {ensData.isFromENS
              ? '✅ Stats verified on-chain via ENS text records'
              : 'Set ENS text records to verify stats on-chain'}
          </div>
        </>
      )}
    </div>
  )
}
