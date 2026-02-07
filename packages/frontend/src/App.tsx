import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

import { config } from './wagmi'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import LeaderDashboard from './pages/LeaderDashboard'
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
                <Route path="/leader" element={<LeaderDashboard />} />
                <Route path="/copier" element={<CopierDashboard />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
              </Routes>
            </Layout>
          </Router>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export default App
