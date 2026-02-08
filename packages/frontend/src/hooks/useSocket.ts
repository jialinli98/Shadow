import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001'

let socket: Socket | null = null

/**
 * Hook to manage Socket.io connection and real-time events
 */
export function useSocket() {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<any>(null)

  useEffect(() => {
    // Initialize socket connection
    if (!socket) {
      socket = io(WS_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      socket.on('connect', () => {
        console.log('[Socket] Connected to Shadow relay')
        setIsConnected(true)
      })

      socket.on('disconnect', () => {
        console.log('[Socket] Disconnected from Shadow relay')
        setIsConnected(false)
      })

      socket.on('error', (error) => {
        console.error('[Socket] Error:', error)
      })
    }

    return () => {
      // Don't disconnect on component unmount - keep connection alive
    }
  }, [])

  /**
   * Subscribe to real-time events
   */
  const subscribe = (event: string, handler: (data: any) => void) => {
    if (!socket) return

    socket.on(event, (data) => {
      setLastEvent({ event, data, timestamp: Date.now() })
      handler(data)
    })

    return () => {
      socket?.off(event, handler)
    }
  }

  /**
   * Emit an event to the server
   */
  const emit = (event: string, data: any) => {
    if (!socket) return
    socket.emit(event, data)
  }

  /**
   * Subscribe to leader updates
   */
  const subscribeToLeader = (leaderAddress: string) => {
    if (!socket) return
    socket.emit('subscribe-leader', leaderAddress)
  }

  /**
   * Unsubscribe from leader updates
   */
  const unsubscribeFromLeader = (leaderAddress: string) => {
    if (!socket) return
    socket.emit('unsubscribe-leader', leaderAddress)
  }

  /**
   * Subscribe to copier updates
   */
  const subscribeToCopier = (copierAddress: string) => {
    if (!socket) return
    socket.emit('subscribe-copier', copierAddress)
  }

  /**
   * Unsubscribe from copier updates
   */
  const unsubscribeFromCopier = (copierAddress: string) => {
    if (!socket) return
    socket.emit('unsubscribe-copier', copierAddress)
  }

  /**
   * Subscribe to price updates for an asset
   */
  const subscribeToPrice = (asset: string) => {
    if (!socket) return
    socket.emit('subscribe-price', asset)
  }

  /**
   * Unsubscribe from price updates
   */
  const unsubscribeFromPrice = (asset: string) => {
    if (!socket) return
    socket.emit('unsubscribe-price', asset)
  }

  /**
   * Get current stats
   */
  const getStats = () => {
    if (!socket) return
    socket.emit('get-stats')
  }

  /**
   * Ping server
   */
  const ping = () => {
    if (!socket) return
    socket.emit('ping')
  }

  return {
    isConnected,
    lastEvent,
    subscribe,
    emit,
    subscribeToLeader,
    unsubscribeFromLeader,
    subscribeToCopier,
    unsubscribeFromCopier,
    subscribeToPrice,
    unsubscribeFromPrice,
    getStats,
    ping,
  }
}

/**
 * Hook to listen for trade replication events
 */
export function useTradeEvents(leaderAddress?: string) {
  const { subscribe, subscribeToLeader, unsubscribeFromLeader } = useSocket()
  const [recentTrades, setRecentTrades] = useState<any[]>([])

  useEffect(() => {
    if (!leaderAddress) return

    // Subscribe to leader's updates
    subscribeToLeader(leaderAddress)

    // Subscribe to trade events
    const unsubTrades = subscribe('trade-replicated', (data) => {
      if (data.data?.leader === leaderAddress) {
        setRecentTrades(prev => [data.data, ...prev].slice(0, 20)) // Keep last 20 trades
      }
    })

    const unsubConfirmed = subscribe('trade-confirmed', (data) => {
      console.log('[Trade] Trade confirmed:', data)
    })

    return () => {
      unsubscribeFromLeader(leaderAddress)
      unsubTrades?.()
      unsubConfirmed?.()
    }
  }, [leaderAddress, subscribeToLeader, unsubscribeFromLeader, subscribe])

  return recentTrades
}

/**
 * Hook to listen for drawdown and risk alerts
 */
export function useRiskAlerts(copierAddress?: string) {
  const { subscribe, subscribeToCopier, unsubscribeFromCopier } = useSocket()
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    if (!copierAddress) return

    // Subscribe to copier's updates
    subscribeToCopier(copierAddress)

    // Subscribe to drawdown breach events
    const unsubBreach = subscribe('drawdown-breach', (data) => {
      if (data.data?.copierAddress === copierAddress) {
        setAlerts(prev => [
          {
            type: 'drawdown-breach',
            ...data.data,
            timestamp: data.data?.timestamp || Date.now(),
          },
          ...prev,
        ].slice(0, 10)) // Keep last 10 alerts
      }
    })

    // Subscribe to drawdown alert events
    const unsubAlert = subscribe('drawdown-alert', (data) => {
      if (data.data) {
        setAlerts(prev => [
          {
            type: 'drawdown-alert',
            copierAddress,
            ...data.data,
            timestamp: data.data?.timestamp || Date.now(),
          },
          ...prev,
        ].slice(0, 10))
      }
    })

    return () => {
      unsubscribeFromCopier(copierAddress)
      unsubBreach?.()
      unsubAlert?.()
    }
  }, [copierAddress, subscribeToCopier, unsubscribeFromCopier, subscribe])

  return alerts
}

/**
 * Hook to listen for leader registration events
 */
export function useLeaderUpdates() {
  const { subscribe } = useSocket()
  const [newLeaders, setNewLeaders] = useState<any[]>([])

  useEffect(() => {
    const unsubscribe = subscribe('leader-registered', (data) => {
      setNewLeaders(prev => [data, ...prev].slice(0, 5))
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  return newLeaders
}

/**
 * Hook to listen for settlement events
 */
export function useSettlementEvents(channelId?: string) {
  const { subscribe } = useSocket()
  const [settlements, setSettlements] = useState<any[]>([])

  useEffect(() => {
    const unsubscribe = subscribe('settlement-completed', (data) => {
      // If channelId is provided, filter by it; otherwise show all settlements
      if (!channelId || data.data?.settlementId === channelId) {
        setSettlements(prev => [data.data, ...prev])
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [channelId, subscribe])

  return settlements
}

/**
 * Hook to listen for price updates
 */
export function usePriceUpdates(asset?: string) {
  const { subscribe, subscribeToPrice, unsubscribeFromPrice } = useSocket()
  const [prices, setPrices] = useState<Record<string, any>>({})

  useEffect(() => {
    // Subscribe to specific asset or all price updates
    if (asset) {
      subscribeToPrice(asset)
    }

    const unsubscribe = subscribe('price-update', (data) => {
      if (!asset || data.data?.asset === asset) {
        setPrices(prev => ({
          ...prev,
          [data.data?.asset]: data.data,
        }))
      }
    })

    return () => {
      if (asset) {
        unsubscribeFromPrice(asset)
      }
      unsubscribe?.()
    }
  }, [asset, subscribe, subscribeToPrice, unsubscribeFromPrice])

  return asset ? prices[asset] : prices
}
