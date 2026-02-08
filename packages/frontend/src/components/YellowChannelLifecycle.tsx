import { useState, useEffect } from 'react'
import { ArrowRight, Lock, Unlock, Zap, FileCheck, Shield } from 'lucide-react'

type ChannelState = 'opening' | 'active' | 'trading' | 'closing' | 'settling' | 'closed'

export default function YellowChannelLifecycle() {
  const [currentState, setCurrentState] = useState<ChannelState>('opening')
  const [stateData, setStateData] = useState({
    nonce: 0,
    balances: { leader: 50000, copier: 50000 },
    signatures: [] as string[],
    trades: 0
  })

  const states: { state: ChannelState; label: string; description: string }[] = [
    { state: 'opening', label: 'Opening', description: 'Participants deposit funds into Yellow channel' },
    { state: 'active', label: 'Active', description: 'Channel ready for trading' },
    { state: 'trading', label: 'Trading', description: 'Off-chain trades updating state' },
    { state: 'closing', label: 'Closing', description: 'Final state agreed upon' },
    { state: 'settling', label: 'Settling', description: 'Proof submitted to Uniswap V4 hook' },
    { state: 'closed', label: 'Closed', description: 'Funds returned to participants' }
  ]

  // Auto-cycle through states for demo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentState(current => {
        const currentIndex = states.findIndex(s => s.state === current)
        const nextIndex = (currentIndex + 1) % states.length
        const nextState = states[nextIndex].state

        // Simulate state updates
        if (nextState === 'trading') {
          setStateData(prev => ({
            nonce: prev.nonce + 1,
            balances: {
              leader: prev.balances.leader + 1500,
              copier: prev.balances.copier - 1500
            },
            signatures: [...prev.signatures, `0x${Math.random().toString(16).slice(2, 10)}...`],
            trades: prev.trades + 1
          }))
        }

        return nextState
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const getStateColor = (state: ChannelState) => {
    if (state === currentState) return 'bg-indigo-600 border-indigo-400'
    const currentIndex = states.findIndex(s => s.state === currentState)
    const stateIndex = states.findIndex(s => s.state === state)
    return stateIndex < currentIndex ? 'bg-green-600/50 border-green-500' : 'bg-gray-700 border-gray-600'
  }

  const getStateIcon = (state: ChannelState) => {
    switch (state) {
      case 'opening': return <Unlock className="w-4 h-4" />
      case 'active': return <Zap className="w-4 h-4" />
      case 'trading': return <Zap className="w-4 h-4 animate-pulse" />
      case 'closing': return <Lock className="w-4 h-4" />
      case 'settling': return <FileCheck className="w-4 h-4" />
      case 'closed': return <Shield className="w-4 h-4" />
    }
  }

  return (
    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        <Zap className="w-5 h-5 mr-2 text-purple-500" />
        State Channel Lifecycle
      </h3>

      {/* State Flow Diagram */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {states.map((state, index) => (
            <div key={state.state} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${getStateColor(state.state)}`}
                >
                  {getStateIcon(state.state)}
                </div>
                <div className={`mt-2 text-xs font-semibold ${state.state === currentState ? 'text-indigo-400' : 'text-gray-500'}`}>
                  {state.label}
                </div>
              </div>
              {index < states.length - 1 && (
                <ArrowRight className="w-4 h-4 text-gray-600 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Current State Details */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 mb-4">
        <div className="flex items-center space-x-2 mb-3">
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
          <span className="text-sm font-semibold text-white">Current State: {states.find(s => s.state === currentState)?.label}</span>
        </div>
        <p className="text-sm text-gray-400 mb-4">{states.find(s => s.state === currentState)?.description}</p>

        {/* State Data */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-gray-900/50 rounded p-2">
            <div className="text-gray-500 mb-1">State Nonce</div>
            <div className="font-mono text-white">{stateData.nonce}</div>
          </div>
          <div className="bg-gray-900/50 rounded p-2">
            <div className="text-gray-500 mb-1">Trades</div>
            <div className="font-mono text-white">{stateData.trades}</div>
          </div>
          <div className="bg-gray-900/50 rounded p-2">
            <div className="text-gray-500 mb-1">Leader Balance</div>
            <div className="font-mono text-green-400">${stateData.balances.leader.toLocaleString()}</div>
          </div>
          <div className="bg-gray-900/50 rounded p-2">
            <div className="text-gray-500 mb-1">Copier Balance</div>
            <div className="font-mono text-blue-400">${stateData.balances.copier.toLocaleString()}</div>
          </div>
        </div>

        {/* Latest Signature */}
        {stateData.signatures.length > 0 && currentState === 'trading' && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-1">Latest State Signature</div>
            <div className="font-mono text-xs text-purple-400 break-all">
              {stateData.signatures[stateData.signatures.length - 1]}
              {Math.random().toString(16).slice(2, 66)}
            </div>
          </div>
        )}
      </div>

      {/* Adjudicator Info */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-start space-x-2">
          <Shield className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-gray-300">
            <p className="font-semibold text-white mb-1">Yellow Adjudicator (ERC-7824)</p>
            <p className="mb-2">Contract: <span className="font-mono text-purple-400">0x0871...8418</span></p>
            <p>The adjudicator verifies state signatures when settling. If there's a dispute, participants can submit the latest signed state to recover funds.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
