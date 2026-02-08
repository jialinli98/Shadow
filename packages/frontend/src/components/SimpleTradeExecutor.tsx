import { useState } from 'react'
import { TrendingUp, Lock, CheckCircle, Loader2 } from 'lucide-react'

interface SimpleTradeExecutorProps {
  leaderAddress: string
}

export default function SimpleTradeExecutor({ leaderAddress }: SimpleTradeExecutorProps) {
  const [asset, setAsset] = useState('ETH')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [amount, setAmount] = useState('2.0')
  const [price, setPrice] = useState('2000')
  const [isExecuting, setIsExecuting] = useState(false)
  const [executed, setExecuted] = useState(false)
  const [sessionId, setSessionId] = useState('')

  const handleExecute = async () => {
    setIsExecuting(true)

    // Simulate trade execution
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Generate mock session ID
    const mockSessionId = `0x${Math.random().toString(16).slice(2, 10)}`
    setSessionId(mockSessionId)

    setIsExecuting(false)
    setExecuted(true)

    // Reset after 5 seconds
    setTimeout(() => setExecuted(false), 5000)
  }

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-500" />
          Execute New Trade
        </h2>
        <p className="text-sm text-gray-400">Trade off-chain for privacy and zero gas</p>
      </div>

      {/* Trade Form */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Asset */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Asset</label>
            <select
              value={asset}
              onChange={(e) => setAsset(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="ETH">ETH</option>
              <option value="WBTC">WBTC</option>
              <option value="USDC">USDC</option>
            </select>
          </div>

          {/* Side */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Side</label>
            <select
              value={side}
              onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.1"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              placeholder="0.0"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Price (USD)</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              step="1"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Execute Button */}
      <button
        onClick={handleExecute}
        disabled={isExecuting || executed || !amount || !price}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isExecuting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Executing Trade...
          </>
        ) : executed ? (
          <>
            <CheckCircle className="w-5 h-5" />
            Trade Executed
          </>
        ) : (
          'Execute Trade'
        )}
      </button>

      {/* Execution Status */}
      {executed && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Trade executed in session #{sessionId.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Zero gas fees</span>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>No mempool exposure</span>
          </div>
        </div>
      )}

      {/* Benefits */}
      <div className="grid grid-cols-3 gap-2 mt-6">
        <div className="bg-gray-800/50 rounded p-2 text-center">
          <div className="text-green-400 text-lg font-bold">$0</div>
          <div className="text-xs text-gray-400">Gas Fees</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2 text-center">
          <div className="text-blue-400 text-lg font-bold">0ms</div>
          <div className="text-xs text-gray-400">Latency</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2 text-center">
          <div className="text-purple-400 text-lg font-bold">100%</div>
          <div className="text-xs text-gray-400">Private</div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-800/50 rounded p-3 mt-4">
        <Lock className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-gray-300">Instant execution</span> • Trades execute off-chain with cryptographic proofs
        </div>
      </div>
    </div>
  )
}
