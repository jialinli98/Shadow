import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Leader APIs
export const leaderAPI = {
  /**
   * Get all registered leaders
   */
  getAll: async () => {
    const response = await api.get('/api/leaders')
    return response.data
  },

  /**
   * Get leader profile by address
   */
  getProfile: async (address: string) => {
    const response = await api.get(`/api/leaders/${address}`)
    return response.data
  },

  /**
   * Get leader's copiers
   */
  getCopiers: async (address: string) => {
    const response = await api.get(`/api/copiers/by-leader/${address}`)
    return response.data
  },

  /**
   * Get leader's performance metrics
   */
  getMetrics: async (address: string) => {
    const response = await api.get(`/api/leaders/${address}/metrics`)
    return response.data
  },

  /**
   * Register as a leader
   */
  register: async (data: {
    address: string
    ensName: string
    performanceFee: number
    minDeposit: string
  }) => {
    const response = await api.post('/api/leaders/register', data)
    return response.data
  },
}

// Copier APIs
export const copierAPI = {
  /**
   * Get copier profile by address
   */
  getProfile: async (address: string) => {
    const response = await api.get(`/api/copiers/${address}`)
    return response.data
  },

  /**
   * Subscribe to a leader
   */
  subscribe: async (data: {
    copierAddress: string
    leaderAddress: string
    deposit: string
    maxDrawdown: number
  }) => {
    const response = await api.post('/api/copiers/subscribe', data)
    return response.data
  },

  /**
   * Unsubscribe from a leader
   */
  unsubscribe: async (copierAddress: string, leaderAddress: string) => {
    const response = await api.post('/api/copiers/unsubscribe', {
      copierAddress,
      leaderAddress,
    })
    return response.data
  },

  /**
   * Get copier's risk metrics
   */
  getRiskMetrics: async (copierAddress: string, leaderAddress: string) => {
    const response = await api.get(`/api/risk-metrics/${copierAddress}/${leaderAddress}`)
    return response.data
  },
}

// Trade APIs
export const tradeAPI = {
  /**
   * Get trade history for a session
   */
  getHistory: async (channelId: string) => {
    const response = await api.get(`/api/trades/${channelId}`)
    return response.data
  },

  /**
   * Execute a trade (leader only)
   */
  execute: async (data: {
    leaderAddress: string
    asset: string
    side: 'BUY' | 'SELL'
    amount: string
    price: number
  }) => {
    const response = await api.post('/api/trades/execute', data)
    return response.data
  },
}

// Stats APIs
export const statsAPI = {
  /**
   * Get platform statistics
   */
  getPlatformStats: async () => {
    const response = await api.get('/api/stats/platform')
    return response.data
  },

  /**
   * Get leaderboard data
   */
  getLeaderboard: async (params?: {
    sortBy?: 'roi' | 'volume' | 'copiers'
    limit?: number
  }) => {
    const response = await api.get('/api/stats/leaderboard', { params })
    return response.data
  },
}

export default api
