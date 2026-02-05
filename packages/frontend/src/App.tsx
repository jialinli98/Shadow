import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <nav className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-white">Shadow</h1>
                <span className="ml-3 text-sm text-gray-400">Private Copy Trading</span>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

function HomePage() {
  return (
    <div className="text-center py-20">
      <h2 className="text-5xl font-bold text-white mb-4">
        Trade Without Exposing Your Alpha
      </h2>
      <p className="text-xl text-gray-300 mb-8">
        Private copy trading on Yellow Network state channels
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-5xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Leaders</h3>
          <p className="text-gray-400">Monetize your strategy without leaking alpha</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Copiers</h3>
          <p className="text-gray-400">Follow top traders with built-in risk controls</p>
        </div>
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">Private</h3>
          <p className="text-gray-400">All trades happen off-chain until settlement</p>
        </div>
      </div>
    </div>
  )
}

export default App
