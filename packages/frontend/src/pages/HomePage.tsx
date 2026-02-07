import { useNavigate } from 'react-router-dom'
import { Shield, Users, Lock, TrendingUp, Zap, Eye } from 'lucide-react'
import { useAccount } from 'wagmi'

export default function HomePage() {
  const navigate = useNavigate()
  const { isConnected } = useAccount()

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <div className="text-center py-20">
        <h1 className="text-6xl font-bold text-white mb-6">
          Trade Without Exposing Your{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500">
            Alpha
          </span>
        </h1>
        <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
          The first copy trading platform where getting more followers doesn't destroy your edge.
          All trades happen off-chain in Yellow Network state channels.
        </p>
        <div className="flex justify-center space-x-4">
          {isConnected ? (
            <>
              <button
                onClick={() => navigate('/leader')}
                className="px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition"
              >
                Become a Leader
              </button>
              <button
                onClick={() => navigate('/leaderboard')}
                className="px-8 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition"
              >
                Browse Leaders
              </button>
            </>
          ) : (
            <p className="text-gray-400">Connect your wallet to get started</p>
          )}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard
          icon={<Lock className="w-12 h-12 text-indigo-500" />}
          title="Private Execution"
          description="Trades happen off-chain in Yellow Network state channels. Market never sees your order flow."
        />
        <FeatureCard
          icon={<Shield className="w-12 h-12 text-purple-500" />}
          title="Non-Custodial"
          description="You control your funds. State channels ensure trustless execution with cryptographic proofs."
        />
        <FeatureCard
          icon={<Zap className="w-12 h-12 text-blue-500" />}
          title="Zero Gas Fees"
          description="Trade as much as you want off-chain. Only pay gas on final settlement via Uniswap V4."
        />
        <FeatureCard
          icon={<Eye className="w-12 h-12 text-green-500" />}
          title="MEV Protected"
          description="No mempool exposure means no front-running, no sandwich attacks, no JIT sniping."
        />
        <FeatureCard
          icon={<TrendingUp className="w-12 h-12 text-orange-500" />}
          title="Risk Management"
          description="Built-in drawdown limits and position sizing protect copiers automatically."
        />
        <FeatureCard
          icon={<Users className="w-12 h-12 text-pink-500" />}
          title="Performance Fees"
          description="Leaders earn % of copier profits. ENS-based reputation system for trust."
        />
      </div>

      {/* How It Works */}
      <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-lg p-8">
        <h2 className="text-3xl font-bold text-white mb-8 text-center">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Step
            number={1}
            title="Leader Registers"
            description="Create ENS profile with strategy, set performance fee (max 30%)"
          />
          <Step
            number={2}
            title="Copier Subscribes"
            description="Choose leader, set deposit amount and max drawdown limit"
          />
          <Step
            number={3}
            title="Private Trading"
            description="Leader trades off-chain, Shadow relay replicates to all copiers"
          />
          <Step
            number={4}
            title="Settlement"
            description="Close session → final state settles via Uniswap V4 with fees"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Privacy Guarantee"
          value="100%"
          description="Individual trades never visible on-chain"
        />
        <StatCard
          label="MEV Protection"
          value="Complete"
          description="Zero mempool exposure"
        />
        <StatCard
          label="Settlement Layer"
          value="Uniswap V4"
          description="Final swaps execute atomically"
        />
      </div>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6 hover:border-indigo-500/50 transition">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  )
}

function Step({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  )
}

function StatCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-lg p-6">
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-gray-500">{description}</div>
    </div>
  )
}
