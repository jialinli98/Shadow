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
   * Join a room for targeted updates
   */
  const joinRoom = (room: string) => {
    if (!socket) return
    socket.emit('join-room', room)
  }

  /**
   * Leave a room
   */
  const leaveRoom = (room: string) => {
    if (!socket) return
    socket.emit('leave-room', room)
  }

  return {
    isConnected,
    lastEvent,
    subscribe,
    emit,
    joinRoom,
    leaveRoom,
  }
}

/**
 * Hook to listen for trade replication events
 */
export function useTradeEvents(leaderAddress?: string) {
  const { subscribe, joinRoom, leaveRoom } = useSocket()
  const [recentTrades, setRecentTrades] = useState<any[]>([])

  useEffect(() => {
    if (!leaderAddress) return

    // Join leader's room for targeted updates
    joinRoom(`leader-${leaderAddress}`)

    // Subscribe to trade events
    const unsubscribe = subscribe('trade-replicated', (data) => {
      if (data.leaderAddress === leaderAddress) {
        setRecentTrades(prev => [data, ...prev].slice(0, 20)) // Keep last 20 trades
      }
    })

    return () => {
      leaveRoom(`leader-${leaderAddress}`)
      unsubscribe?.()
    }
  }, [leaderAddress])

  return recentTrades
}

/**
 * Hook to listen for risk limit breaches
 */
export function useRiskAlerts(copierAddress?: string) {
  const { subscribe, joinRoom, leaveRoom } = useSocket()
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    if (!copierAddress) return

    // Join copier's room for targeted alerts
    joinRoom(`copier-${copierAddress}`)

    // Subscribe to risk events
    const unsubscribe = subscribe('risk-limit-breached', (data) => {
      if (data.copierAddress === copierAddress) {
        setAlerts(prev => [data, ...prev].slice(0, 10)) // Keep last 10 alerts
      }
    })

    return () => {
      leaveRoom(`copier-${copierAddress}`)
      unsubscribe?.()
    }
  }, [copierAddress])

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
    if (!channelId) return

    const unsubscribe = subscribe('session-settled', (data) => {
      if (data.channelId === channelId) {
        setSettlements(prev => [data, ...prev])
      }
    })

    return () => {
      unsubscribe?.()
    }
  }, [channelId])

  return settlements
}
