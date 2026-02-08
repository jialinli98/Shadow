import { useState } from 'react'
import { Shield, CheckCircle, ExternalLink } from 'lucide-react'

export default function QuickSettlement() {
  const [settling, setSettling] = useState(false)
  const [settled, setSettled] = useState(false)

  const handleSettle = async () => {
    setSettling(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setSettling(false)
    setSettled(true)
    setTimeout(() => setSettled(false), 3000)
  }

  const hookAddress = '0x5829730e04Fe6C50f8a5A3A8b49E6F28FF146aF8'

  return (
    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-500" />
          <h2 className="text-lg font-semibold text-white">Settlement</h2>
        </div>
        <a
          href={`https://sepolia.etherscan.io/address/${hookAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-300 transition flex items-center gap-1 font-mono"
        >
          {hookAddress.slice(0, 6)}...{hookAddress.slice(-4)}
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-400 mb-1">Pending Trades</div>
          <div className="text-2xl font-bold text-white">8</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-1">Net Position</div>
          <div className="text-2xl font-bold text-green-400">+3.0 ETH</div>
        </div>
      </div>

      <div className="bg-green-500/10 border border-green-500/30 rounded p-3 mb-4 text-sm">
        <div className="flex justify-between mb-1">
          <span className="text-gray-400">Without batching:</span>
          <span className="text-gray-500 line-through">$120</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-white font-semibold">With batching:</span>
          <span className="text-green-400 font-bold">$25</span>
        </div>
        <div className="text-xs text-green-400 mt-2">
          Save $95 (79%)
        </div>
      </div>

      <button
        onClick={handleSettle}
        disabled={settling || settled}
        className="w-full py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {settling ? 'Settling...' : settled ? '✓ Settled' : 'Settle Now'}
      </button>

      {settled && (
        <div className="mt-3 text-xs text-green-400 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>Hook verified proof • Net swap executed</span>
        </div>
      )}
    </div>
  )
}
