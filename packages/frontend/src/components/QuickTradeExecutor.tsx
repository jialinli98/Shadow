import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { Zap, CheckCircle, AlertCircle } from 'lucide-react'
import axios from 'axios'
import { parseEther } from 'viem'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface QuickTradeExecutorProps {
  leaderAddress: string
}

// Token addresses for different assets
const TOKEN_ADDRESSES: { [key: string]: string } = {
  'ETH': '0x0000000000000000000000000000000000000000',
  'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
}

export default function QuickTradeExecutor({ leaderAddress }: QuickTradeExecutorProps) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [asset, setAsset] = useState('ETH')
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY')
  const [amount, setAmount] = useState('2.0')
  const [executing, setExecuting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExecute = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first')
      return
    }

    setExecuting(true)
    setError(null)
    setSuccess(false)

    try {
      // Get current price from oracle
      const priceResponse = await axios.get(`${API_URL}/api/prices/${asset}`)
      const currentPrice = priceResponse.data.price

      // Convert amount to wei (18 decimals)
      const amountWei = parseEther(amount)

      // Price is already in correct format from API (USDC with 6 decimals)
      const priceWei = currentPrice

      // Create trade object
      const tradeId = `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const timestamp = Date.now()

      const trade = {
        tradeId,
        asset,
        action: side,
        tokenAddress: TOKEN_ADDRESSES[asset],
        amount: amountWei.toString(),
        price: priceWei.toString(),
        timestamp, // Include timestamp in trade object
        yellowChannelId: `channel-${leaderAddress}`, // Will be set by backend
      }

      // Create message to sign (must match backend verification)
      const messageToSign = JSON.stringify({
        tradeId: trade.tradeId,
        asset: trade.asset,
        action: trade.action,
        amount: trade.amount,
        price: trade.price,
        timestamp: trade.timestamp,
      })

      // Sign the trade
      const signature = await signMessageAsync({ message: messageToSign })

      // Execute trade via API
      const response = await axios.post(`${API_URL}/api/trades/execute`, {
        leaderAddress: address, // Use connected wallet as leader
        trade,
        signature,
      })

      console.log('Trade executed:', response.data)

      setExecuting(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 5000)
    } catch (err: any) {
      console.error('Trade execution failed:', err)
      setError(err.response?.data?.message || err.message || 'Trade execution failed')
      setExecuting(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-semibold text-white">Quick Trade</h2>
      </div>

      <div className="flex gap-2 mb-4">
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </select>

        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
        />

        <select
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="ETH">ETH</option>
          <option value="WBTC">WBTC</option>
          <option value="USDC">USDC</option>
        </select>

        <button
          onClick={handleExecute}
          disabled={executing || success || !amount || !isConnected}
          className="px-6 py-2 bg-blue-500 text-white rounded font-semibold hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
        >
          {!isConnected ? 'Connect Wallet' : executing ? 'Executing...' : success ? '✓ Done' : 'Execute'}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-sm text-green-400 mb-2">
          <CheckCircle className="w-4 h-4" />
          <span>Trade executed on Yellow Network • Zero gas • No MEV exposure</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 mb-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-green-400 font-bold">$0</div>
          <div className="text-gray-500">Gas</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-blue-400 font-bold">Instant</div>
          <div className="text-gray-500">Speed</div>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <div className="text-purple-400 font-bold">Private</div>
          <div className="text-gray-500">MEV Protection</div>
        </div>
      </div>
    </div>
  )
}
