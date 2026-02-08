import { useState } from 'react'
import { Shield, ExternalLink, CheckCircle, Loader2 } from 'lucide-react'

interface SettlementSummaryProps {
  pendingTrades?: number
  netPosition?: string
  estimatedGas?: number
  gasSavings?: number
}

export default function SettlementSummary({
  pendingTrades = 8,
  netPosition = '+3.0 ETH',
  estimatedGas = 25,
  gasSavings = 95
}: SettlementSummaryProps) {
  const [isSettling, setIsSettling] = useState(false)
  const [settled, setSettled] = useState(false)

  const handleSettle = async () => {
    setIsSettling(true)

    // Simulate settlement process
    await new Promise(resolve => setTimeout(resolve, 3000))

    setIsSettling(false)
    setSettled(true)

    // Reset after 5 seconds
    setTimeout(() => setSettled(false), 5000)
  }

  const hookAddress = '0x5829730e04Fe6C50f8a5A3A8b49E6F28FF146aF8'

  return (
    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-500" />
            Ready to Settle
          </h2>
          <p className="text-sm text-gray-400">Batch your trades into one on-chain transaction</p>
        </div>
      </div>

      {/* Settlement Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-2">Pending Trades</div>
          <div className="text-3xl font-bold text-white">{pendingTrades}</div>
          <div className="text-xs text-gray-500 mt-1">Executed off-chain</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-2">Net Position</div>
          <div className="text-3xl font-bold text-green-400">{netPosition}</div>
          <div className="text-xs text-gray-500 mt-1">Final settlement</div>
        </div>
      </div>

      {/* Gas Savings */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-300">Without batching:</span>
          <span className="text-sm text-gray-400 line-through">${estimatedGas + gasSavings}</span>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-white">Settlement cost:</span>
          <span className="text-lg font-bold text-green-400">${estimatedGas}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-green-500/20">
          <span className="text-xs text-gray-400">You save:</span>
          <span className="text-sm font-semibold text-green-400">
            ${gasSavings} ({Math.round((gasSavings / (estimatedGas + gasSavings)) * 100)}%)
          </span>
        </div>
      </div>

      {/* Settlement Button */}
      <button
        onClick={handleSettle}
        disabled={isSettling || settled}
        className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-semibold hover:from-green-600 hover:to-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSettling ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Settling Position...
          </>
        ) : settled ? (
          <>
            <CheckCircle className="w-5 h-5" />
            Settlement Complete
          </>
        ) : (
          'Settle Position'
        )}
      </button>

      {/* Settlement Status */}
      {settled && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Settlement hook verified cryptographic proof</span>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Net swap executed: {netPosition}</span>
          </div>
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span>Individual trades remain private</span>
          </div>
        </div>
      )}

      {/* Hook Info */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">Settlement Contract:</span>
          <a
            href={`https://sepolia.etherscan.io/address/${hookAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 font-mono"
          >
            {hookAddress.slice(0, 6)}...{hookAddress.slice(-4)}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-800/50 rounded p-3 mt-4">
        <Shield className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="text-gray-300">Verified on-chain</span> • Settlement contract verifies cryptographic proofs and executes atomically
        </div>
      </div>
    </div>
  )
}
