import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Activity, CheckCircle, Loader } from 'lucide-react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface TradeExecutorProps {
  leaderAddress: string
}

// Market prices (simulated current prices)
const MARKET_PRICES: { [key: string]: number } = {
  'ETH': 2045,
  'BTC': 45200,
  'SOL': 98,
  'AVAX': 35
}

export default function TradeExecutor({ leaderAddress }: TradeExecutorProps) {
  const { address } = useAccount()
  const [asset, setAsset] = useState('ETH')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [amount, setAmount] = useState('1')
  const [isExecuting, setIsExecuting] = useState(false)
  const [tradeStatus, setTradeStatus] = useState<string | null>(null)
  const [channelId, setChannelId] = useState<string | null>(null)

  // Get current market price for selected asset
  const marketPrice = MARKET_PRICES[asset] || 0
  const tradeValue = parseFloat(amount || '0') * marketPrice

  const handleExecuteTrade = async () => {
    if (!address) {
      alert('Please connect your wallet first!')
      return
    }

    setIsExecuting(true)
    setTradeStatus('Finding active Yellow Network state channel...')

    try {
      // Get leader's active channels
      await new Promise(resolve => setTimeout(resolve, 800))
      const channelsResponse = await axios.get(`${API_URL}/api/state-channels/${leaderAddress}`)
      const activeChannels = channelsResponse.data.filter((c: any) => c.status === 'active')

      let currentChannelId: string

      if (activeChannels.length > 0) {
        // Use existing active channel
        currentChannelId = activeChannels[0].channelId
        setChannelId(currentChannelId)
        setTradeStatus('Using existing state channel ✓')
      } else {
        // Open new channel
        setTradeStatus('Opening new Yellow Network state channel...')
        await new Promise(resolve => setTimeout(resolve, 1000))

        const newChannelResponse = await axios.post(`${API_URL}/api/state-channels/open`, {
          leaderAddress,
          copierAddress: '0x899D9B792a2A4E1166D058D68d17DC0Df33666C7', // Your copier address
          initialBalance: 50000
        })

        currentChannelId = newChannelResponse.data.channelId
        setChannelId(currentChannelId)
        setTradeStatus('State channel opened ✓')
      }

      await new Promise(resolve => setTimeout(resolve, 800))
      setTradeStatus('Executing trade off-chain in Yellow state channel...')

      // Add trade to state channel
      await new Promise(resolve => setTimeout(resolve, 1200))
      await axios.post(`${API_URL}/api/state-channels/${currentChannelId}/trade`, {
        asset,
        side,
        amount: parseFloat(amount),
        price: marketPrice,
      })

      setTradeStatus('Trade executed privately ✓')

      await new Promise(resolve => setTimeout(resolve, 800))
      setTradeStatus('State nonce incremented, balances updated...')

      await new Promise(resolve => setTimeout(resolve, 800))
      setTradeStatus('Replicating to copiers via Shadow Relay...')

      // Also broadcast to legacy trade endpoint
      await axios.post(`${API_URL}/api/trades/execute`, {
        leaderAddress,
        asset,
        side,
        amount,
        price: marketPrice,
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      setTradeStatus('✅ Trade added to state channel! Check Yellow dashboard.')

      await new Promise(resolve => setTimeout(resolve, 3000))
      setIsExecuting(false)
      setTradeStatus(null)
      setChannelId(null)
    } catch (error) {
      console.error('Trade execution failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setTradeStatus(`❌ Trade failed: ${errorMessage}`)
      setIsExecuting(false)

      // Keep error visible for longer
      setTimeout(() => {
        setTradeStatus(null)
      }, 8000)
    }
  }

  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
      <h2 className="text-2xl font-semibold text-white mb-4 flex items-center">
        <Activity className="w-6 h-6 mr-2 text-indigo-500" />
        Execute Trade (Yellow Network)
      </h2>

      {!isExecuting ? (
        <>
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Asset</label>
                <select
                  value={asset}
                  onChange={(e) => setAsset(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="ETH">ETH</option>
                  <option value="BTC">BTC</option>
                  <option value="SOL">SOL</option>
                  <option value="AVAX">AVAX</option>
                </select>
                <div className="mt-1 text-xs text-gray-500">
                  Market Price: ${marketPrice.toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Side</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSide('BUY')}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      side === 'BUY'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    onClick={() => setSide('SELL')}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      side === 'SELL'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    SELL
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Amount</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Trade Summary */}
            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Order Type:</span>
                <span className="text-white font-semibold">Market Order</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-400">Execution Price:</span>
                <span className="text-white font-semibold">${marketPrice.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-indigo-500/30">
                <span className="text-gray-300 font-semibold">Total Trade Value:</span>
                <span className="text-indigo-400 font-bold text-lg">
                  ${tradeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleExecuteTrade}
            disabled={!address}
            className={`w-full py-3 rounded-lg font-semibold transition ${
              address
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {address ? 'Execute Trade via Yellow Network' : 'Connect Wallet to Execute Trade'}
          </button>

          <div className="mt-4 text-sm text-gray-400">
            <p className="mb-2">🔒 <strong>How It Works:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Market order executes at current price (${marketPrice.toLocaleString()})</li>
              <li>Trade happens off-chain in Yellow state channel</li>
              <li>Copiers replicate proportionally (also off-chain)</li>
              <li>Only net settlement visible on-chain via Uniswap V4</li>
              <li>No mempool exposure = No MEV attacks</li>
            </ul>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 text-white">
            <Loader className="w-5 h-5 animate-spin text-indigo-500" />
            <span>{tradeStatus}</span>
          </div>

          {channelId && (
            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Yellow State Channel ID:</div>
              <div className="text-xs font-mono text-indigo-400 break-all">{channelId}</div>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <CheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-gray-300">
                <p className="font-semibold text-white mb-1">Yellow Network Integration</p>
                <p>This trade is executing in an off-chain state channel using ERC-7824 (Nitrolite).
                Your copiers will receive the same trade instantly, all privately.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
