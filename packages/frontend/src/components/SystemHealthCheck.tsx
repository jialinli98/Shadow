import { useState, useEffect } from 'react'
import { useAccount, usePublicClient, useReadContract } from 'wagmi'
import { CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-react'

const REGISTRY_ADDRESS = (import.meta.env.VITE_REGISTRY_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
const FEE_MANAGER_ADDRESS = (import.meta.env.VITE_FEE_MANAGER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
const SETTLEMENT_HOOK_ADDRESS = (import.meta.env.VITE_SETTLEMENT_HOOK_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

type CheckStatus = 'pending' | 'success' | 'warning' | 'error'

interface HealthCheck {
  name: string
  status: CheckStatus
  message: string
  details?: string
}

export default function SystemHealthCheck() {
  const { address, isConnected, chain } = useAccount()
  const publicClient = usePublicClient()
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [isChecking, setIsChecking] = useState(true)

  // Check if leader is registered
  const { data: isRegistered } = useReadContract({
    address: REGISTRY_ADDRESS,
    abi: [{
      name: 'isRegistered',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'leader', type: 'address' }],
      outputs: [{ type: 'bool' }],
    }],
    functionName: 'isRegistered',
    args: address ? [address] : undefined,
  })

  useEffect(() => {
    const runHealthChecks = async () => {
      const results: HealthCheck[] = []

      // 1. Wallet Connection
      if (!isConnected || !address) {
        results.push({
          name: 'Wallet Connection',
          status: 'error',
          message: 'Wallet not connected',
          details: 'Please connect your wallet to continue'
        })
      } else {
        results.push({
          name: 'Wallet Connection',
          status: 'success',
          message: 'Wallet connected',
          details: `Address: ${address.slice(0, 6)}...${address.slice(-4)}`
        })
      }

      // 2. Network Check
      if (chain?.id !== 11155111) {
        results.push({
          name: 'Network',
          status: 'error',
          message: 'Wrong network',
          details: 'Please switch to Sepolia testnet'
        })
      } else {
        results.push({
          name: 'Network',
          status: 'success',
          message: 'Connected to Sepolia',
          details: 'Chain ID: 11155111'
        })
      }

      // 3. Contract Addresses
      const contracts = [
        { name: 'ShadowRegistry', address: REGISTRY_ADDRESS },
        { name: 'ShadowFeeManager', address: FEE_MANAGER_ADDRESS },
        { name: 'ShadowSettlementHook', address: SETTLEMENT_HOOK_ADDRESS }
      ]

      for (const contract of contracts) {
        if (contract.address === '0x0000000000000000000000000000000000000000') {
          results.push({
            name: contract.name,
            status: 'error',
            message: 'Contract address not set',
            details: 'Check .env file'
          })
        } else {
          // Try to get code at address
          try {
            if (publicClient) {
              const code = await publicClient.getBytecode({ address: contract.address as `0x${string}` })
              if (code && code !== '0x') {
                results.push({
                  name: contract.name,
                  status: 'success',
                  message: 'Contract deployed',
                  details: `${contract.address.slice(0, 6)}...${contract.address.slice(-4)}`
                })
              } else {
                results.push({
                  name: contract.name,
                  status: 'error',
                  message: 'No contract at address',
                  details: contract.address
                })
              }
            }
          } catch (error) {
            results.push({
              name: contract.name,
              status: 'warning',
              message: 'Could not verify contract',
              details: contract.address
            })
          }
        }
      }

      // 4. Leader Registration
      if (isConnected && address) {
        if (isRegistered) {
          results.push({
            name: 'Leader Registration',
            status: 'success',
            message: 'Leader is registered',
            details: 'Ready to trade'
          })
        } else {
          results.push({
            name: 'Leader Registration',
            status: 'warning',
            message: 'Leader not registered',
            details: 'You need to register as a leader first'
          })
        }
      }

      // 5. API Connection
      try {
        const response = await fetch(`${API_URL}/health`, { method: 'GET' })
        if (response.ok) {
          results.push({
            name: 'API Server',
            status: 'success',
            message: 'API is running',
            details: API_URL
          })
        } else {
          results.push({
            name: 'API Server',
            status: 'warning',
            message: 'API responded with error',
            details: `Status: ${response.status}`
          })
        }
      } catch (error) {
        results.push({
          name: 'API Server',
          status: 'error',
          message: 'Cannot connect to API',
          details: `Check if server is running at ${API_URL}`
        })
      }

      // 6. Environment Variables
      const envVars = [
        { name: 'VITE_REGISTRY_ADDRESS', value: import.meta.env.VITE_REGISTRY_ADDRESS },
        { name: 'VITE_FEE_MANAGER_ADDRESS', value: import.meta.env.VITE_FEE_MANAGER_ADDRESS },
        { name: 'VITE_SETTLEMENT_HOOK_ADDRESS', value: import.meta.env.VITE_SETTLEMENT_HOOK_ADDRESS },
        { name: 'VITE_WALLETCONNECT_PROJECT_ID', value: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID },
      ]

      const missingEnvVars = envVars.filter(v => !v.value)
      if (missingEnvVars.length > 0) {
        results.push({
          name: 'Environment Variables',
          status: 'error',
          message: `${missingEnvVars.length} missing`,
          details: missingEnvVars.map(v => v.name).join(', ')
        })
      } else {
        results.push({
          name: 'Environment Variables',
          status: 'success',
          message: 'All variables set',
          details: '4/4 configured'
        })
      }

      setChecks(results)
      setIsChecking(false)
    }

    runHealthChecks()
  }, [address, isConnected, chain, publicClient, isRegistered])

  const getStatusIcon = (status: CheckStatus) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'error': return <XCircle className="w-5 h-5 text-red-500" />
      case 'pending': return <Loader className="w-5 h-5 text-gray-500 animate-spin" />
    }
  }

  const getStatusColor = (status: CheckStatus) => {
    switch (status) {
      case 'success': return 'border-green-500/30 bg-green-500/10'
      case 'warning': return 'border-yellow-500/30 bg-yellow-500/10'
      case 'error': return 'border-red-500/30 bg-red-500/10'
      case 'pending': return 'border-gray-500/30 bg-gray-500/10'
    }
  }

  const successCount = checks.filter(c => c.status === 'success').length
  const warningCount = checks.filter(c => c.status === 'warning').length
  const errorCount = checks.filter(c => c.status === 'error').length

  const overallStatus: CheckStatus =
    errorCount > 0 ? 'error' :
    warningCount > 0 ? 'warning' :
    successCount === checks.length ? 'success' : 'pending'

  return (
    <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white flex items-center">
          {getStatusIcon(overallStatus)}
          <span className="ml-3">System Health Check</span>
        </h2>
        {!isChecking && (
          <div className="text-sm space-x-4">
            {successCount > 0 && (
              <span className="text-green-400">✓ {successCount} Passed</span>
            )}
            {warningCount > 0 && (
              <span className="text-yellow-400">⚠ {warningCount} Warnings</span>
            )}
            {errorCount > 0 && (
              <span className="text-red-400">✗ {errorCount} Errors</span>
            )}
          </div>
        )}
      </div>

      {isChecking ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="ml-3 text-gray-400">Running system checks...</span>
        </div>
      ) : (
        <>
          <div className="space-y-3 mb-6">
            {checks.map((check, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getStatusColor(check.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {getStatusIcon(check.status)}
                    <div className="flex-1">
                      <div className="font-semibold text-white">{check.name}</div>
                      <div className="text-sm text-gray-300">{check.message}</div>
                      {check.details && (
                        <div className="text-xs text-gray-500 mt-1 font-mono">
                          {check.details}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Overall Status */}
          {overallStatus === 'success' && (
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">System Ready for Demo! 🎉</span>
              </div>
              <p className="text-sm text-gray-300 mt-2">
                All systems operational. You're good to go for the hackathon demo.
              </p>
            </div>
          )}

          {overallStatus === 'warning' && (
            <div className="bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-yellow-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-semibold">System Partially Ready ⚠️</span>
              </div>
              <p className="text-sm text-gray-300 mt-2">
                Some non-critical issues detected. Demo will work but may have limited functionality.
              </p>
            </div>
          )}

          {overallStatus === 'error' && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center space-x-2 text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Critical Issues Detected ❌</span>
              </div>
              <p className="text-sm text-gray-300 mt-2">
                Please fix the errors above before proceeding with the demo.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
