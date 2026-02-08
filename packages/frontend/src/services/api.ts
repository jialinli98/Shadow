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
   * Get all registered leaders (leaderboard)
   */
  getAll: async () => {
    const response = await api.get('/api/leaders')
    return response.data
  },

  /**
   * Get leader profile and stats by address
   */
  getProfile: async (address: string) => {
    const response = await api.get(`/api/leaders/${address}`)
    return response.data
  },

  /**
   * Register as a leader
   */
  register: async (data: {
    address: string
    ensName: string
    performanceFee: number
  }) => {
    const response = await api.post('/api/leaders/register', data)
    return response.data
  },
}

// Session APIs (Yellow Network channels)
export const sessionAPI = {
  /**
   * Open a new Yellow Network session
   */
  open: async (data: {
    userAddress: string
    collateral: string
  }) => {
    const response = await api.post('/api/sessions/open', data)
    return response.data
  },

  /**
   * Get session details by channel ID
   */
  getSession: async (channelId: string) => {
    const response = await api.get(`/api/sessions/${channelId}`)
    return response.data
  },

  /**
   * Get all active sessions
   */
  getAllSessions: async () => {
    const response = await api.get('/api/sessions')
    return response.data
  },

  /**
   * Settle a channel
   */
  settle: async (channelId: string) => {
    const response = await api.post(`/api/sessions/${channelId}/settle`)
    return response.data
  },

  /**
   * Preview settlement before executing
   */
  previewSettlement: async (channelId: string) => {
    const response = await api.get(`/api/sessions/${channelId}/settlement-preview`)
    return response.data
  },
}

// Copier APIs
export const copierAPI = {
  /**
   * Get copier portfolio by address
   */
  getPortfolio: async (address: string) => {
    const response = await api.get(`/api/copiers/${address}`)
    return response.data
  },

  /**
   * Subscribe to a leader
   */
  subscribe: async (data: {
    copierAddress: string
    leaderAddress: string
    copierChannelId: string
    performanceFee?: number
    maxDrawdown?: number
  }) => {
    const response = await api.post('/api/copiers/subscribe', data)
    return response.data
  },
}

// Trade APIs
export const tradeAPI = {
  /**
   * Execute a trade (leader only)
   */
  execute: async (data: {
    leaderAddress: string
    trade: {
      tradeId?: string
      asset: string
      action: 'BUY' | 'SELL'
      amount: string
      price: string
      tokenAddress?: string
      yellowChannelId?: string
    }
    signature: string
  }) => {
    const response = await api.post('/api/trades/execute', data)
    return response.data
  },
}

// Oracle APIs
export const oracleAPI = {
  /**
   * Get current price for an asset
   */
  getPrice: async (asset: string) => {
    const response = await api.get(`/api/prices/${asset}`)
    return response.data
  },

  /**
   * Get all available prices
   */
  getAllPrices: async () => {
    const response = await api.get('/api/prices')
    return response.data
  },
}

// Market Maker APIs
export const marketMakerAPI = {
  /**
   * Get Market Maker statistics
   */
  getStats: async () => {
    const response = await api.get('/api/market-maker/stats')
    return response.data
  },

  /**
   * Get Market Maker exposure summary
   */
  getExposure: async () => {
    const response = await api.get('/api/market-maker/exposure')
    return response.data
  },
}

// Health check
export const healthAPI = {
  /**
   * Health check endpoint
   */
  check: async () => {
    const response = await api.get('/api/health')
    return response.data
  },
}

export default api
