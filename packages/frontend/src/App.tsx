import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

import { config } from './wagmi'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import UnifiedDashboard from './pages/UnifiedDashboard'
import BrowseLeaders from './pages/BrowseLeaders'
import HealthCheck from './pages/HealthCheck'
import { IntegrationTest } from './pages/IntegrationTest'
// Legacy pages (kept for reference)
import LeaderDashboard from './pages/LeaderDashboard'
import SimplifiedLeaderDashboard from './pages/SimplifiedLeaderDashboard'
import CopierDashboard from './pages/CopierDashboard'
import Leaderboard from './pages/Leaderboard'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/dashboard" element={<UnifiedDashboard />} />
                <Route path="/browse" element={<BrowseLeaders />} />
                <Route path="/health" element={<HealthCheck />} />
                <Route path="/test" element={<IntegrationTest />} />

                {/* Legacy routes - redirect to new pages */}
                <Route path="/leader" element={<LeaderDashboard />} />
                <Route path="/copier" element={<UnifiedDashboard />} />
                <Route path="/leaderboard" element={<BrowseLeaders />} />

                {/* Leader registration routes */}
                <Route path="/register/leader" element={<LeaderDashboard />} />
                <Route path="/leader/full" element={<LeaderDashboard />} />

                {/* Old versions for reference */}
                <Route path="/legacy/leader" element={<LeaderDashboard />} />
                <Route path="/legacy/simplified" element={<SimplifiedLeaderDashboard />} />
                <Route path="/legacy/copier" element={<CopierDashboard />} />
                <Route path="/legacy/leaderboard" element={<Leaderboard />} />
              </Routes>
            </Layout>
          </Router>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
