import { User, ExternalLink } from 'lucide-react'

interface ENSProfileDisplayProps {
  address: `0x${string}`
  ensName?: string
}

export default function ENSProfileDisplay({ address, ensName }: ENSProfileDisplayProps) {
  const displayName = ensName || `${address.slice(0, 6)}...${address.slice(-4)}`
  const hasENS = !!ensName

  // Generate a simple avatar from ENS name
  const avatarColor = ensName
    ? `hsl(${ensName.charCodeAt(0) * 137.5 % 360}, 70%, 50%)`
    : 'hsl(200, 70%, 50%)'

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
        <User className="w-5 h-5 mr-2 text-green-500" />
        ENS Profile
      </h3>

      <div className="flex items-start space-x-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold border-2 border-green-500"
          style={{ background: `linear-gradient(135deg, ${avatarColor}, hsl(200, 70%, 50%))` }}
        >
          {displayName[0].toUpperCase()}
        </div>

        <div className="flex-1">
          <div className="text-2xl font-bold text-white mb-1">{displayName}</div>
          <div className="text-sm text-gray-400 font-mono mb-2">{address}</div>

          {hasENS && (
            <div className="flex items-center space-x-3">
              <a
                href={`https://app.ens.domains/${ensName}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-sm text-green-500 hover:text-green-400 transition"
              >
                <span>View on ENS</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-500 rounded-full">
                ENS Registered
              </span>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
