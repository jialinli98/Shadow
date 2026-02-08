/**
 * Integration Test Page
 * Demonstrates frontend-backend API integration
 */
import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import {
  leaderAPI,
  sessionAPI,
  copierAPI,
  oracleAPI,
  marketMakerAPI,
  healthAPI,
} from '../services/api'
import { useSocket, usePriceUpdates, useTradeEvents } from '../hooks/useSocket'

export function IntegrationTest() {
  const { address } = useAccount()
  const { isConnected: wsConnected } = useSocket()

  // State
  const [health, setHealth] = useState<any>(null)
  const [prices, setPrices] = useState<any>(null)
  const [leaders, setLeaders] = useState<any>(null)
  const [sessionData, setSessionData] = useState<any>(null)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<Record<string, string>>({})

  // Real-time price updates
  const ethPrice = usePriceUpdates('ETH')

  // Test functions
  const testHealth = async () => {
    setLoading(prev => ({ ...prev, health: true }))
    try {
      const data = await healthAPI.check()
      setHealth(data)
      setError(prev => ({ ...prev, health: '' }))
    } catch (err: any) {
      setError(prev => ({ ...prev, health: err.message }))
    } finally {
      setLoading(prev => ({ ...prev, health: false }))
    }
  }

  const testPrices = async () => {
    setLoading(prev => ({ ...prev, prices: true }))
    try {
      const data = await oracleAPI.getAllPrices()
      setPrices(data)
      setError(prev => ({ ...prev, prices: '' }))
    } catch (err: any) {
      setError(prev => ({ ...prev, prices: err.message }))
    } finally {
      setLoading(prev => ({ ...prev, prices: false }))
    }
  }

  const testLeaders = async () => {
    setLoading(prev => ({ ...prev, leaders: true }))
    try {
      const data = await leaderAPI.getAll()
      setLeaders(data)
      setError(prev => ({ ...prev, leaders: '' }))
    } catch (err: any) {
      setError(prev => ({ ...prev, leaders: err.message }))
    } finally {
      setLoading(prev => ({ ...prev, leaders: false }))
    }
  }

  const testRegisterLeader = async () => {
    if (!address) {
      setError(prev => ({ ...prev, register: 'Connect wallet first' }))
      return
    }

    setLoading(prev => ({ ...prev, register: true }))
    try {
      const data = await leaderAPI.register({
        address,
        ensName: `${address.slice(0, 6)}.shadow.eth`,
        performanceFee: 0.15,
      })
      alert('Leader registered successfully!')
      setError(prev => ({ ...prev, register: '' }))
      await testLeaders() // Refresh leaders list
    } catch (err: any) {
      setError(prev => ({ ...prev, register: err.message }))
    } finally {
      setLoading(prev => ({ ...prev, register: false }))
    }
  }

  const testOpenSession = async () => {
    if (!address) {
      setError(prev => ({ ...prev, session: 'Connect wallet first' }))
      return
    }

    setLoading(prev => ({ ...prev, session: true }))
    try {
      const data = await sessionAPI.open({
        userAddress: address,
        collateral: '1000000000000000000', // 1 USDC
      })
      setSessionData(data)
      setError(prev => ({ ...prev, session: '' }))
      alert(`Session opened! Channel ID: ${data.channelId}`)
    } catch (err: any) {
      setError(prev => ({ ...prev, session: err.message }))
    } finally {
      setLoading(prev => ({ ...prev, session: false }))
    }
  }

  // Auto-load on mount
  useEffect(() => {
    testHealth()
    testPrices()
    testLeaders()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold mb-2">Shadow API Integration Test</h1>
          <p className="text-gray-600">Testing frontend-backend connectivity</p>

          <div className="mt-4 flex gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">WebSocket: {wsConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${health?.status === 'ok' ? 'bg-green-500' : 'bg-gray-300'}`} />
              <span className="text-sm">API: {health?.status || 'Unknown'}</span>
            </div>
            {address && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm">Wallet: {address.slice(0, 6)}...{address.slice(-4)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Real-time Prices */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Real-time Price Feed (WebSocket)</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ethPrice && (
              <div className="border rounded p-3">
                <div className="text-sm text-gray-600">ETH (Live)</div>
                <div className="text-2xl font-bold text-green-600">{ethPrice.formatted}</div>
                <div className="text-xs text-gray-500">
                  Updated: {new Date(ethPrice.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
            {prices?.prices?.map((price: any) => (
              <div key={price.asset} className="border rounded p-3">
                <div className="text-sm text-gray-600">{price.asset}</div>
                <div className="text-2xl font-bold">{price.formatted}</div>
              </div>
            ))}
          </div>
          <button
            onClick={testPrices}
            disabled={loading.prices}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading.prices ? 'Loading...' : 'Refresh Prices'}
          </button>
          {error.prices && <div className="mt-2 text-red-500 text-sm">{error.prices}</div>}
        </div>

        {/* Health Check */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">API Health</h2>
          {health && (
            <div className="bg-gray-50 rounded p-4 font-mono text-sm">
              <pre>{JSON.stringify(health, null, 2)}</pre>
            </div>
          )}
          <button
            onClick={testHealth}
            disabled={loading.health}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading.health ? 'Checking...' : 'Check Health'}
          </button>
        </div>

        {/* Leaders */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Leaders</h2>
          {leaders && (
            <div className="bg-gray-50 rounded p-4">
              <div className="font-semibold mb-2">Total Leaders: {leaders.total}</div>
              {leaders.leaders?.length === 0 ? (
                <div className="text-gray-500 italic">No leaders registered yet</div>
              ) : (
                <div className="space-y-2">
                  {leaders.leaders?.map((leader: any) => (
                    <div key={leader.leaderAddress} className="border rounded p-3">
                      <div className="font-mono text-sm">{leader.leaderAddress}</div>
                      <div className="text-sm text-gray-600">
                        Copiers: {leader.activeCopiers} | Trades: {leader.totalTrades}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={testLeaders}
              disabled={loading.leaders}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading.leaders ? 'Loading...' : 'Refresh Leaders'}
            </button>
            <button
              onClick={testRegisterLeader}
              disabled={loading.register || !address}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {loading.register ? 'Registering...' : 'Register as Leader'}
            </button>
          </div>
          {error.register && <div className="mt-2 text-red-500 text-sm">{error.register}</div>}
        </div>

        {/* Session Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Yellow Network Sessions</h2>
          {sessionData && (
            <div className="bg-gray-50 rounded p-4 mb-4">
              <div className="font-semibold mb-2">Session Created!</div>
              <div className="font-mono text-sm space-y-1">
                <div>Channel ID: {sessionData.channelId}</div>
                <div>User: {sessionData.userAddress}</div>
                <div>Collateral: {sessionData.collateral} wei (1 USDC)</div>
              </div>
            </div>
          )}
          <button
            onClick={testOpenSession}
            disabled={loading.session || !address}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
          >
            {loading.session ? 'Opening...' : 'Open Session (1 USDC)'}
          </button>
          {error.session && <div className="mt-2 text-red-500 text-sm">{error.session}</div>}
          {!address && <div className="mt-2 text-gray-500 text-sm">Connect wallet to open a session</div>}
        </div>

        {/* API Endpoints Reference */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Available API Endpoints</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-mono">
            <div>
              <div className="font-bold mb-2">Leaders</div>
              <div className="space-y-1 text-gray-600">
                <div>GET /api/leaders</div>
                <div>GET /api/leaders/:address</div>
                <div>POST /api/leaders/register</div>
              </div>
            </div>
            <div>
              <div className="font-bold mb-2">Sessions</div>
              <div className="space-y-1 text-gray-600">
                <div>POST /api/sessions/open</div>
                <div>GET /api/sessions/:channelId</div>
                <div>POST /api/sessions/:channelId/settle</div>
              </div>
            </div>
            <div>
              <div className="font-bold mb-2">Copiers</div>
              <div className="space-y-1 text-gray-600">
                <div>GET /api/copiers/:address</div>
                <div>POST /api/copiers/subscribe</div>
              </div>
            </div>
            <div>
              <div className="font-bold mb-2">Oracle</div>
              <div className="space-y-1 text-gray-600">
                <div>GET /api/prices</div>
                <div>GET /api/prices/:asset</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
