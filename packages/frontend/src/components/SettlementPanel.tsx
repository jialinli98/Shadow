import { useState } from 'react'
import { Wallet, CheckCircle, AlertCircle } from 'lucide-react'

export default function SettlementPanel() {
  const [isSettling, setIsSettling] = useState(false)
  const [settlementStatus, setSettlementStatus] = useState<string | null>(null)

  const handleSettle = async () => {
    setIsSettling(true)
    setSettlementStatus('Closing Yellow state channel...')

    await new Promise(resolve => setTimeout(resolve, 1000))
    setSettlementStatus('Generating state channel proof...')

    await new Promise(resolve => setTimeout(resolve, 1200))
    setSettlementStatus('Calling Uniswap V4 Settlement Hook...')

    await new Promise(resolve => setTimeout(resolve, 1500))
    setSettlementStatus('Hook verifying state channel signatures...')

    await new Promise(resolve => setTimeout(resolve, 1000))
    setSettlementStatus('Executing Uniswap V4 swap (net position only)...')

    await new Promise(resolve => setTimeout(resolve, 1500))
    setSettlementStatus('Processing performance fees...')

    await new Promise(resolve => setTimeout(resolve, 1000))
    setSettlementStatus('✅ Settlement complete!')

    await new Promise(resolve => setTimeout(resolve, 2500))
    setIsSettling(false)
    setSettlementStatus(null)
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        <Wallet className="w-5 h-5 mr-2 text-purple-500" />
        Uniswap V4 Settlement
      </h3>

      {!isSettling ? (
        <>
          <div className="mb-4 space-y-2 text-sm text-gray-300">
            <p><strong className="text-white">Current Session:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Total Trades: 0 (simulated)</li>
              <li>Net Position: 0 ETH</li>
              <li>Status: No trades to settle</li>
            </ul>
          </div>

          <button
            onClick={handleSettle}
            disabled
            className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Settle via Uniswap V4 (Demo)
          </button>

          <div className="mt-4 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold text-white mb-1">Uniswap V4 Hook Integration</p>
                <p><strong>ShadowSettlementHook:</strong> 0x5829...46aF8</p>
                <p className="mt-2">When settling, the hook:</p>
                <ul className="list-disc list-inside mt-1 ml-4">
                  <li>Verifies Yellow state channel proof</li>
                  <li>Prevents double-settlement attacks</li>
                  <li>Processes performance fees atomically</li>
                  <li>Executes Uniswap swap for net position</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-white">
            <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <span>{settlementStatus}</span>
          </div>

          <div className="bg-gray-800 rounded-lg p-4 font-mono text-xs space-y-2">
            <div className="text-purple-400">&gt; afterSwap()</div>
            <div className="text-gray-500 ml-4">// Verify state channel proof</div>
            <div className="text-gray-400 ml-4">yellowAdjudicator.verifyFinalState()</div>
            <div className="text-gray-500 ml-4">// Prevent double settlement</div>
            <div className="text-gray-400 ml-4">settledChannels[channelId] = true</div>
            <div className="text-gray-500 ml-4">// Process fees</div>
            <div className="text-gray-400 ml-4">feeManager.processCopierFee()</div>
            <div className="text-green-400 ml-4">✓ Settlement verified</div>
          </div>
        </div>
      )}
    </div>
  )
}
