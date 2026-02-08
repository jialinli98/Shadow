import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { normalize } from 'viem/ens'
import { Twitter, Globe, MessageCircle, TrendingUp, Shield, Coins, Award, Target, Percent, BarChart3, Trophy } from 'lucide-react'

interface ENSMetadataProps {
  ensName: string
  address: `0x${string}`
  demoMode?: boolean // Set to true to show example data for hackathon demo
}

interface TraderMetadata {
  description?: string
  twitter?: string
  discord?: string
  website?: string
  strategy?: string
  riskLevel?: string
  assets?: string
  experience?: string
  avatar?: string
  // Performance & Achievement metrics
  winRate?: string
  roi?: string
  totalTrades?: string
  avgReturn?: string
  sharpeRatio?: string
  achievements?: string
}

export default function ENSMetadata({ ensName, address, demoMode = false }: ENSMetadataProps) {
  const [metadata, setMetadata] = useState<TraderMetadata>({})
  const [loading, setLoading] = useState(true)
  const publicClient = usePublicClient()

  useEffect(() => {
    const fetchENSRecords = async () => {
      // Demo mode: Show example data for hackathon presentation
      if (demoMode) {
        setMetadata({
          description: "Experienced DeFi trader specializing in MEV-protected arbitrage strategies. Consistent 15% monthly returns with risk management protocols.",
          twitter: "shadowtrader",
          discord: "shadowtrader#1337",
          website: "https://shadow-trader.eth.limo",
          strategy: "DeFi Arbitrage & Market Making",
          riskLevel: "Moderate",
          assets: "ETH, WBTC, USDC, DeFi Blue Chips",
          experience: "5+ years",
          // Performance metrics
          winRate: "73.5%",
          roi: "+284%",
          totalTrades: "1,247",
          avgReturn: "+2.8%",
          sharpeRatio: "1.85",
          achievements: "Top 10 Trader 2025, DeFi Expert, Risk Manager",
        })
        setLoading(false)
        return
      }

      if (!publicClient || !ensName) {
        setLoading(false)
        return
      }

      try {
        const normalizedName = normalize(ensName)

        // Fetch ENS text records for trading metadata
        const [description, twitter, discord, website, strategy, riskLevel, assets, experience, avatar,
               winRate, roi, totalTrades, avgReturn, sharpeRatio, achievements] = await Promise.allSettled([
          publicClient.getEnsText({ name: normalizedName, key: 'description' }),
          publicClient.getEnsText({ name: normalizedName, key: 'com.twitter' }),
          publicClient.getEnsText({ name: normalizedName, key: 'com.discord' }),
          publicClient.getEnsText({ name: normalizedName, key: 'url' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.strategy' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.risk' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.assets' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.experience' }),
          publicClient.getEnsAvatar({ name: normalizedName }),
          // Performance metrics
          publicClient.getEnsText({ name: normalizedName, key: 'trading.winrate' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.roi' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.totalTrades' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.avgReturn' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.sharpeRatio' }),
          publicClient.getEnsText({ name: normalizedName, key: 'trading.achievements' }),
        ])

        setMetadata({
          description: description.status === 'fulfilled' && description.value ? description.value : undefined,
          twitter: twitter.status === 'fulfilled' && twitter.value ? twitter.value : undefined,
          discord: discord.status === 'fulfilled' && discord.value ? discord.value : undefined,
          website: website.status === 'fulfilled' && website.value ? website.value : undefined,
          strategy: strategy.status === 'fulfilled' && strategy.value ? strategy.value : undefined,
          riskLevel: riskLevel.status === 'fulfilled' && riskLevel.value ? riskLevel.value : undefined,
          assets: assets.status === 'fulfilled' && assets.value ? assets.value : undefined,
          experience: experience.status === 'fulfilled' && experience.value ? experience.value : undefined,
          avatar: avatar.status === 'fulfilled' && avatar.value ? avatar.value : undefined,
          // Performance metrics
          winRate: winRate.status === 'fulfilled' && winRate.value ? winRate.value : undefined,
          roi: roi.status === 'fulfilled' && roi.value ? roi.value : undefined,
          totalTrades: totalTrades.status === 'fulfilled' && totalTrades.value ? totalTrades.value : undefined,
          avgReturn: avgReturn.status === 'fulfilled' && avgReturn.value ? avgReturn.value : undefined,
          sharpeRatio: sharpeRatio.status === 'fulfilled' && sharpeRatio.value ? sharpeRatio.value : undefined,
          achievements: achievements.status === 'fulfilled' && achievements.value ? achievements.value : undefined,
        })
      } catch (error) {
        console.error('Error fetching ENS records:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchENSRecords()
  }, [ensName, publicClient, demoMode])

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-6">
        <div className="flex items-center space-x-2 text-gray-400">
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading ENS metadata...</span>
        </div>
      </div>
    )
  }

  const hasMetadata = metadata.description || metadata.twitter || metadata.discord || metadata.website ||
                      metadata.strategy || metadata.riskLevel || metadata.assets || metadata.experience ||
                      metadata.winRate || metadata.roi || metadata.totalTrades || metadata.avgReturn ||
                      metadata.sharpeRatio || metadata.achievements

  if (!hasMetadata) {
    return (
      <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-6">
        <h3 className="text-xl font-semibold text-white mb-4">📝 ENS Profile Metadata</h3>
        <div className="text-gray-400 text-sm">
          <p className="mb-3">This leader hasn't set up ENS text records yet.</p>
          <p className="text-xs">Shadow uses ENS as a decentralized database to store:</p>
          <ul className="list-disc list-inside mt-2 ml-4 text-xs space-y-1">
            <li><strong>Profile:</strong> trading.strategy, trading.risk, trading.assets, trading.experience</li>
            <li><strong>Performance:</strong> trading.winrate, trading.roi, trading.totalTrades, trading.avgReturn, trading.sharpeRatio</li>
            <li><strong>Achievements:</strong> trading.achievements (badges, awards, milestones)</li>
            <li><strong>Social:</strong> description, com.twitter, com.discord, url</li>
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        <Trophy className="w-5 h-5 mr-2 text-green-500" />
        Trading Profile (Stored on ENS)
      </h3>

      {/* Performance Metrics - Most Important for Copiers */}
      {(metadata.winRate || metadata.roi || metadata.totalTrades || metadata.avgReturn || metadata.sharpeRatio) && (
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <BarChart3 className="w-5 h-5 text-green-400" />
            <h4 className="text-lg font-semibold text-white">Verified Performance</h4>
            <span className="text-xs text-gray-500 font-mono">(from ENS)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {metadata.winRate && (
              <div className="bg-gradient-to-br from-green-600/20 to-green-600/5 rounded-lg p-4 border border-green-500/30">
                <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
                  <Target className="w-3 h-3" />
                  <span>Win Rate</span>
                </div>
                <div className="text-2xl font-bold text-green-400">{metadata.winRate}</div>
                <div className="text-xs text-gray-500 font-mono mt-1">trading.winrate</div>
              </div>
            )}

            {metadata.roi && (
              <div className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 rounded-lg p-4 border border-purple-500/30">
                <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Total ROI</span>
                </div>
                <div className="text-2xl font-bold text-purple-400">{metadata.roi}</div>
                <div className="text-xs text-gray-500 font-mono mt-1">trading.roi</div>
              </div>
            )}

            {metadata.totalTrades && (
              <div className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 rounded-lg p-4 border border-blue-500/30">
                <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
                  <BarChart3 className="w-3 h-3" />
                  <span>Trades</span>
                </div>
                <div className="text-2xl font-bold text-blue-400">{metadata.totalTrades}</div>
                <div className="text-xs text-gray-500 font-mono mt-1">trading.totalTrades</div>
              </div>
            )}

            {metadata.avgReturn && (
              <div className="bg-gradient-to-br from-indigo-600/20 to-indigo-600/5 rounded-lg p-4 border border-indigo-500/30">
                <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
                  <Percent className="w-3 h-3" />
                  <span>Avg Return</span>
                </div>
                <div className="text-2xl font-bold text-indigo-400">{metadata.avgReturn}</div>
                <div className="text-xs text-gray-500 font-mono mt-1">trading.avgReturn</div>
              </div>
            )}

            {metadata.sharpeRatio && (
              <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-600/5 rounded-lg p-4 border border-yellow-500/30">
                <div className="flex items-center space-x-1 text-xs text-gray-400 mb-1">
                  <Shield className="w-3 h-3" />
                  <span>Sharpe Ratio</span>
                </div>
                <div className="text-2xl font-bold text-yellow-400">{metadata.sharpeRatio}</div>
                <div className="text-xs text-gray-500 font-mono mt-1">trading.sharpeRatio</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Achievements */}
      {metadata.achievements && (
        <div className="mb-4 bg-gradient-to-r from-yellow-600/10 to-orange-600/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-semibold text-white">Achievements</span>
            <span className="text-xs text-gray-500 font-mono">trading.achievements</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {metadata.achievements.split(',').map((achievement, idx) => (
              <span key={idx} className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-semibold border border-yellow-500/30">
                🏆 {achievement.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trading Strategy Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {metadata.strategy && (
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center space-x-2 text-sm text-gray-400 mb-1">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span className="font-mono text-xs">trading.strategy</span>
            </div>
            <div className="text-white font-semibold">{metadata.strategy}</div>
          </div>
        )}

        {metadata.riskLevel && (
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center space-x-2 text-sm text-gray-400 mb-1">
              <Shield className="w-4 h-4 text-yellow-500" />
              <span className="font-mono text-xs">trading.risk</span>
            </div>
            <div className="text-white font-semibold">{metadata.riskLevel}</div>
          </div>
        )}

        {metadata.assets && (
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center space-x-2 text-sm text-gray-400 mb-1">
              <Coins className="w-4 h-4 text-green-500" />
              <span className="font-mono text-xs">trading.assets</span>
            </div>
            <div className="text-white font-semibold">{metadata.assets}</div>
          </div>
        )}

        {metadata.experience && (
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center space-x-2 text-sm text-gray-400 mb-1">
              <Award className="w-4 h-4 text-purple-500" />
              <span className="font-mono text-xs">trading.experience</span>
            </div>
            <div className="text-white font-semibold">{metadata.experience}</div>
          </div>
        )}
      </div>

      {/* Description */}
      {metadata.description && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 mb-4">
          <div className="text-sm text-gray-400 mb-2 font-mono">description</div>
          <p className="text-gray-300 text-sm">{metadata.description}</p>
        </div>
      )}

      {/* Social Links */}
      {(metadata.twitter || metadata.discord || metadata.website) && (
        <div className="flex flex-wrap gap-3">
          {metadata.twitter && (
            <a
              href={`https://twitter.com/${metadata.twitter}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-sm text-blue-400 transition"
            >
              <Twitter className="w-4 h-4" />
              <span>@{metadata.twitter}</span>
            </a>
          )}

          {metadata.discord && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-purple-600/20 border border-purple-500/30 rounded-lg text-sm text-purple-400">
              <MessageCircle className="w-4 h-4" />
              <span>{metadata.discord}</span>
            </div>
          )}

          {metadata.website && (
            <a
              href={metadata.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-3 py-2 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm text-gray-300 transition"
            >
              <Globe className="w-4 h-4" />
              <span>Website</span>
            </a>
          )}
        </div>
      )}

      {/* ENS Badge */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="text-xs text-gray-500">
          ✅ <strong className="text-green-400">Decentralized Profile</strong> - All metadata stored on-chain via ENS text records
          {demoMode && <span className="ml-2 text-yellow-500">(Demo data - set real ENS records on mainnet)</span>}
        </div>
      </div>
    </div>
  )
}
