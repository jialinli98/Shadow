import { useState } from 'react'
import { Package, ArrowRight, DollarSign, Zap, TrendingDown } from 'lucide-react'

interface Trade {
  id: number
  asset: string
  side: 'BUY' | 'SELL'
  amount: number
  price: number
  timestamp: number
}

export default function YellowBatchSettlement() {
  const [showSettlement, setShowSettlement] = useState(false)

  // Mock trades in the channel (market orders at historical prices)
  const trades: Trade[] = [
    { id: 1, asset: 'ETH', side: 'BUY', amount: 2.5, price: 2045, timestamp: Date.now() - 3600000 },
    { id: 2, asset: 'ETH', side: 'SELL', amount: 1.0, price: 2048, timestamp: Date.now() - 3300000 },
    { id: 3, asset: 'WBTC', side: 'BUY', amount: 0.5, price: 45200, timestamp: Date.now() - 3000000 },
    { id: 4, asset: 'ETH', side: 'BUY', amount: 1.5, price: 2043, timestamp: Date.now() - 2700000 },
    { id: 5, asset: 'WBTC', side: 'SELL', amount: 0.3, price: 45150, timestamp: Date.now() - 2400000 },
    { id: 6, asset: 'ETH', side: 'SELL', amount: 2.0, price: 2050, timestamp: Date.now() - 2100000 },
    { id: 7, asset: 'USDC', side: 'BUY', amount: 5000, price: 1.0, timestamp: Date.now() - 1800000 },
    { id: 8, asset: 'ETH', side: 'BUY', amount: 3.0, price: 2047, timestamp: Date.now() - 1500000 },
  ]

  // Calculate net position
  const netPosition = {
    ETH: trades.filter(t => t.asset === 'ETH').reduce((sum, t) => {
      return sum + (t.side === 'BUY' ? t.amount : -t.amount)
    }, 0),
    WBTC: trades.filter(t => t.asset === 'WBTC').reduce((sum, t) => {
      return sum + (t.side === 'BUY' ? t.amount : -t.amount)
    }, 0),
    USDC: trades.filter(t => t.asset === 'USDC').reduce((sum, t) => {
      return sum + (t.side === 'BUY' ? t.amount : -t.amount)
    }, 0),
  }

  const gasSavings = trades.length * 15 // ~$15 per trade
  const onChainGas = 25 // One settlement

  const handleSettle = () => {
    setShowSettlement(true)
    setTimeout(() => setShowSettlement(false), 5000)
  }

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        <Package className="w-5 h-5 mr-2 text-blue-500" />
        Batch Settlement Demo
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Off-chain Trades */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">Off-chain Trades ({trades.length})</h4>
            <span className="text-xs text-gray-500">Yellow State Channel</span>
          </div>

          <div className="bg-gray-800/50 rounded-lg border border-gray-700 max-h-64 overflow-y-auto">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between p-2 border-b border-gray-700/50 last:border-b-0 text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    trade.side === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {trade.side}
                  </span>
                  <span className="text-white font-mono">{trade.amount} {trade.asset}</span>
                </div>
                <div className="text-gray-400">@${trade.price.toLocaleString()}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded p-2 text-xs text-gray-300">
            <div className="flex items-center justify-between">
              <span>Gas if each trade was on-chain:</span>
              <span className="text-red-400 font-semibold">${gasSavings.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Net Settlement */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">Net Settlement (1 tx)</h4>
            <span className="text-xs text-gray-500">Uniswap V4</span>
          </div>

          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
            <div className="space-y-3">
              {Object.entries(netPosition).map(([asset, amount]) => (
                amount !== 0 && (
                  <div key={asset} className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Net {asset} Position:</span>
                    <span className={`font-semibold ${amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {amount > 0 ? '+' : ''}{amount.toFixed(2)} {asset}
                    </span>
                  </div>
                )
              ))}

              <div className="pt-3 border-t border-gray-700">
                <div className="text-xs text-gray-500 mb-2">Settlement Transaction:</div>
                <div className="font-mono text-xs text-blue-400 break-all">
                  swap({netPosition.ETH.toFixed(2)} ETH) via ShadowSettlementHook
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded p-2 text-xs text-gray-300">
            <div className="flex items-center justify-between">
              <span>Actual gas cost:</span>
              <span className="text-green-400 font-semibold">${onChainGas}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settlement Arrow */}
      <div className="flex items-center justify-center my-6">
        <button
          onClick={handleSettle}
          className="flex items-center space-x-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg text-white font-semibold transition"
        >
          <span>Settle Channel via Uniswap V4</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {showSettlement && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 animate-pulse">
          <div className="flex items-center space-x-3 text-blue-400">
            <Zap className="w-5 h-5" />
            <span className="font-semibold">Settlement in progress...</span>
          </div>
          <div className="mt-2 text-xs text-gray-400 space-y-1">
            <div>✓ Generating state channel proof</div>
            <div>✓ Calling ShadowSettlementHook.afterSwap()</div>
            <div>✓ Verifying Yellow signatures</div>
            <div>✓ Executing net swap on Uniswap V4</div>
            <div>✓ Processing performance fees</div>
          </div>
        </div>
      )}

      {/* Savings Summary */}
      <div className="bg-gradient-to-r from-green-600/20 to-green-600/5 border border-green-500/30 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <TrendingDown className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-white mb-2">Gas Savings via Yellow Network</p>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-gray-500">Without Yellow:</div>
                <div className="text-red-400 font-bold">${gasSavings}</div>
                <div className="text-gray-500">({trades.length} txs)</div>
              </div>
              <div>
                <div className="text-gray-500">With Yellow:</div>
                <div className="text-green-400 font-bold">${onChainGas}</div>
                <div className="text-gray-500">(1 tx)</div>
              </div>
              <div>
                <div className="text-gray-500">Saved:</div>
                <div className="text-green-400 font-bold">${gasSavings - onChainGas}</div>
                <div className="text-gray-500">({((1 - onChainGas / gasSavings) * 100).toFixed(0)}% less)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
