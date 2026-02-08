import SystemHealthCheck from '../components/SystemHealthCheck'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function HealthCheck() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-purple-900">
      <div className="container mx-auto px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 text-indigo-400 hover:text-indigo-300 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <SystemHealthCheck />

        <div className="mt-6 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Pre-Demo Checklist</h3>

          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex items-start space-x-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-semibold text-white">Wallet Connected</div>
                <div className="text-xs text-gray-500">Connect your leader wallet to the app</div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-semibold text-white">Leader Registered</div>
                <div className="text-xs text-gray-500">Register as a leader with your ENS name</div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-semibold text-white">API Server Running</div>
                <div className="text-xs text-gray-500">Start: cd packages/relay && npm run dev:test</div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-semibold text-white">Browser Hard Refreshed</div>
                <div className="text-xs text-gray-500">Press Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)</div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-semibold text-white">Read Demo Scripts</div>
                <div className="text-xs text-gray-500">
                  HACKATHON_DEMO_READY.md, YELLOW_NETWORK_INTEGRATION_SUMMARY.md, ENS_INTEGRATION_SUMMARY.md
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-semibold text-white">Memorized Key Numbers</div>
                <div className="text-xs text-gray-500">
                  Yellow: 3 channels, 161 trades, $2,415 saved | ENS: 5 metrics, 3 achievements
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input type="checkbox" className="mt-1" />
              <div>
                <div className="font-semibold text-white">Practiced 5-Minute Demo</div>
                <div className="text-xs text-gray-500">ENS (60s) → Yellow (90s) → Uniswap (45s) → Close (45s)</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Quick Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <Link
              to="/leader"
              className="block p-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg transition"
            >
              <div className="font-semibold text-white">Leader Dashboard</div>
              <div className="text-xs text-gray-400 mt-1">Main demo page</div>
            </Link>

            <a
              href="https://sepolia.etherscan.io/address/0x5829730e04Fe6C50f8a5A3A8b49E6F28FF146aF8"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg transition"
            >
              <div className="font-semibold text-white">Uniswap V4 Hook</div>
              <div className="text-xs text-gray-400 mt-1">View on Etherscan</div>
            </a>

            <a
              href="http://localhost:3001"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg transition"
            >
              <div className="font-semibold text-white">API Server</div>
              <div className="text-xs text-gray-400 mt-1">Check if running</div>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
