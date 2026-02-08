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
import LeaderDashboard from './pages/LeaderDashboard'

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

                {/* Additional routes */}
                <Route path="/leader" element={<LeaderDashboard />} />
                <Route path="/register/leader" element={<LeaderDashboard />} />
              </Routes>
            </Layout>
          </Router>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
