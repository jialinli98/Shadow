# Shadow Relay API Documentation

## Overview

The Shadow Relay API provides REST endpoints and WebSocket connections for managing copy trading on the Yellow Network.

**Base URL**: `http://localhost:3001/api/v1`
**WebSocket URL**: `ws://localhost:3001`

## Authentication

Currently no authentication is required (add wallet signature verification for production).

## REST API Endpoints

### Health Check

#### GET /health

Check server health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "yellowNetwork": true,
    "replicationService": true
  }
}
```

---

## Leader Endpoints

### Register Leader

#### POST /api/v1/leaders/register

Register a new leader trader.

**Request Body:**
```json
{
  "leaderAddress": "0x1234...",
  "ensName": "alice.shadow.eth"
}
```

**Response (201):**
```json
{
  "success": true,
  "session": {
    "sessionId": "leader-1705315800000",
    "leaderAddress": "0x1234...",
    "ensName": "alice.shadow.eth",
    "isActive": true,
    "registeredAt": 1705315800000
  },
  "profile": {
    "ensName": "alice.shadow.eth",
    "address": "0x1234...",
    "avatar": "https://...",
    "bio": "Professional crypto trader",
    "strategy": "Long-term value investing",
    "twitter": "@alice",
    "discord": "alice#1234",
    "website": "https://alice.com"
  }
}
```

### Get Leader Profile

#### GET /api/v1/leaders/:address

Get leader profile and session details.

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": "leader-1705315800000",
    "leaderAddress": "0x1234...",
    "ensName": "alice.shadow.eth",
    "isActive": true,
    "registeredAt": 1705315800000,
    "totalCopiers": 5,
    "activeCopiers": 3,
    "totalVolumeReplicated": "1000000000000000000000",
    "totalFeesEarned": "50000000000000000000"
  },
  "profile": { ... },
  "copiers": [
    {
      "copierAddress": "0x5678...",
      "depositAmount": "10000000000000000000000",
      "maxDrawdown": 10,
      "currentValue": "11000000000000000000000",
      "startedAt": 1705315900000
    }
  ]
}
```

### List All Leaders

#### GET /api/v1/leaders

Get list of all registered leaders.

**Response:**
```json
{
  "success": true,
  "count": 10,
  "leaders": [
    {
      "leaderAddress": "0x1234...",
      "ensName": "alice.shadow.eth",
      "isActive": true,
      "totalCopiers": 5,
      "activeCopiers": 3,
      "totalVolumeReplicated": "1000000000000000000000",
      "totalFeesEarned": "50000000000000000000",
      "registeredAt": 1705315800000,
      "profile": {
        "ensName": "alice.shadow.eth",
        "avatar": "https://...",
        "bio": "Professional crypto trader"
      }
    }
  ]
}
```

### Get Leader Stats

#### GET /api/v1/leaders/:address/stats

Get detailed statistics for a leader.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalCopiers": 5,
    "activeCopiers": 3,
    "totalVolumeReplicated": "1000000000000000000000",
    "totalFeesEarned": "50000000000000000000"
  }
}
```

---

## Copier Endpoints

### Subscribe to Leader

#### POST /api/v1/copiers/subscribe

Subscribe a copier to a leader.

**Request Body:**
```json
{
  "copierAddress": "0x5678...",
  "leaderAddress": "0x1234...",
  "depositAmount": "10000000000000000000000",
  "maxDrawdown": 10
}
```

**Response (201):**
```json
{
  "success": true,
  "session": {
    "sessionId": "copier-1705315900000",
    "copierAddress": "0x5678...",
    "leaderAddress": "0x1234...",
    "depositAmount": "10000000000000000000000",
    "maxDrawdown": 10,
    "yellowChannelId": "0xabcd...",
    "startedAt": 1705315900000
  },
  "yellowSession": {
    "sessionId": "yellow-session-123",
    "channelId": "0xabcd...",
    "participants": ["0x1234...", "0x5678..."]
  }
}
```

### Unsubscribe from Leader

#### POST /api/v1/copiers/unsubscribe

Unsubscribe a copier from a leader.

**Request Body:**
```json
{
  "copierAddress": "0x5678...",
  "leaderAddress": "0x1234..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Copier unsubscribed successfully"
}
```

### Get Copier Subscriptions

#### GET /api/v1/copiers/:address

Get all subscriptions and performance for a copier.

**Response:**
```json
{
  "success": true,
  "copierAddress": "0x5678...",
  "subscriptions": [
    {
      "sessionId": "copier-1705315900000",
      "leaderAddress": "0x1234...",
      "leaderEnsName": "alice.shadow.eth",
      "depositAmount": "10000000000000000000000",
      "currentValue": "11000000000000000000000",
      "startValue": "10000000000000000000000",
      "maxDrawdown": 10,
      "currentDrawdown": 2.5,
      "openPositions": 3,
      "dailyLoss": "0",
      "totalPnL": "1000000000000000000000",
      "peakValue": "11000000000000000000000",
      "startedAt": 1705315900000
    }
  ]
}
```

### Get Copier Risk Metrics

#### GET /api/v1/copiers/:address/risk

Get detailed risk metrics for a copier.

**Response:**
```json
{
  "success": true,
  "copierAddress": "0x5678...",
  "risk": [
    {
      "sessionId": "copier-1705315900000",
      "leaderAddress": "0x1234...",
      "metrics": {
        "currentDrawdown": 2.5,
        "openPositions": 3,
        "dailyLoss": "0",
        "totalPnL": "1000000000000000000000",
        "peakValue": "11000000000000000000000"
      },
      "positions": [
        {
          "asset": "ETH",
          "amount": "1000000000000000000",
          "entryPrice": "3000000000000000000000",
          "currentPrice": "3100000000000000000000",
          "unrealizedPnL": "100000000000000000000"
        }
      ]
    }
  ]
}
```

---

## Trade Endpoints

### Replicate Trade

#### POST /api/v1/trades/replicate

Replicate a leader's trade to all copiers.

**Request Body:**
```json
{
  "leaderAddress": "0x1234...",
  "action": "BUY",
  "asset": "ETH",
  "tokenAddress": "0xETH",
  "amount": "1000000000000000000",
  "price": "3000000000000000000000",
  "yellowChannelId": "0xabcd...",
  "signature": "0xsig..."
}
```

**Response:**
```json
{
  "success": true,
  "trade": {
    "tradeId": "trade-1705316000000",
    "leaderAddress": "0x1234...",
    "action": "BUY",
    "asset": "ETH",
    "amount": "1000000000000000000",
    "price": "3000000000000000000000",
    "timestamp": 1705316000000
  },
  "replication": {
    "totalCopiers": 3,
    "successCount": 2,
    "failureCount": 1,
    "results": [
      {
        "copierAddress": "0x5678...",
        "success": true,
        "error": null,
        "executedTrade": {
          "tradeId": "exec-1705316000001",
          "amount": "100000000000000000",
          "price": "3000000000000000000000"
        }
      }
    ]
  }
}
```

### Execute Trade

#### POST /api/v1/trades/execute

Execute a direct trade (non-replicated).

**Request Body:**
```json
{
  "executorAddress": "0x5678...",
  "action": "BUY",
  "asset": "ETH",
  "tokenAddress": "0xETH",
  "amount": "1000000000000000000",
  "price": "3000000000000000000000",
  "yellowChannelId": "0xabcd..."
}
```

**Response:**
```json
{
  "success": true,
  "trade": {
    "tradeId": "exec-1705316000001",
    "executorAddress": "0x5678...",
    "action": "BUY",
    "asset": "ETH",
    "amount": "1000000000000000000",
    "price": "3000000000000000000000",
    "executedAt": 1705316000001,
    "yellowStateNonce": 5
  }
}
```

### Get Trade History

#### GET /api/v1/trades/history/:address

Get trade history for an address.

**Query Parameters:**
- `limit` (default: 100)
- `offset` (default: 0)

**Response:**
```json
{
  "success": true,
  "address": "0x1234...",
  "trades": [],
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 0
  }
}
```

---

## Metrics Endpoints

### Platform Overview

#### GET /api/v1/metrics/overview

Get platform-wide metrics.

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalLeaders": 10,
    "totalCopiers": 50,
    "totalSessions": 50,
    "totalVolumeReplicated": "10000000000000000000000000",
    "totalFeesEarned": "500000000000000000000000",
    "totalValueLocked": "1000000000000000000000000",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Leaderboard

#### GET /api/v1/metrics/leaderboard

Get top leaders by performance.

**Query Parameters:**
- `sortBy`: "copiers", "volume", or "fees" (default: "copiers")
- `limit` (default: 10)

**Response:**
```json
{
  "success": true,
  "sortBy": "copiers",
  "leaderboard": [
    {
      "rank": 1,
      "leaderAddress": "0x1234...",
      "ensName": "alice.shadow.eth",
      "totalCopiers": 10,
      "activeCopiers": 8,
      "totalVolumeReplicated": "5000000000000000000000000",
      "totalFeesEarned": "250000000000000000000000",
      "registeredAt": 1705315800000
    }
  ]
}
```

### Session Metrics

#### GET /api/v1/metrics/session/:sessionId

Get detailed metrics for a specific session.

**Response (Copier Session):**
```json
{
  "success": true,
  "metrics": {
    "sessionId": "copier-1705315900000",
    "type": "copier",
    "copierAddress": "0x5678...",
    "leaderAddress": "0x1234...",
    "depositAmount": "10000000000000000000000",
    "currentValue": "11000000000000000000000",
    "maxDrawdown": 10,
    "currentDrawdown": 2.5,
    "openPositions": 3,
    "dailyLoss": "0",
    "totalPnL": "1000000000000000000000",
    "peakValue": "11000000000000000000000",
    "positions": [...],
    "startedAt": 1705315900000
  }
}
```

---

## WebSocket Events

### Client → Server

#### subscribe

Subscribe to real-time updates.

```json
{
  "type": "leader",
  "address": "0x1234..."
}
```

```json
{
  "type": "copier",
  "address": "0x5678...",
  "leaders": ["0x1234..."]
}
```

```json
{
  "type": "observer"
}
```

#### unsubscribe

Unsubscribe from updates.

```json
{}
```

### Server → Client

#### subscribed

Confirmation of subscription.

```json
{
  "type": "leader",
  "address": "0x1234..."
}
```

#### leader-registered

New leader registered (to observers).

```json
{
  "address": "0x1234...",
  "ensName": "alice.shadow.eth",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### copier-joined

New copier subscribed (to leader).

```json
{
  "copierAddress": "0x5678...",
  "depositAmount": "10000000000000000000000",
  "maxDrawdown": 10,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### subscription-confirmed

Subscription confirmed (to copier).

```json
{
  "leaderAddress": "0x1234...",
  "sessionId": "copier-1705315900000",
  "yellowChannelId": "0xabcd...",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### trade-executed

Trade executed for copier (to copier).

```json
{
  "tradeId": "exec-1705316000001",
  "asset": "ETH",
  "action": "BUY",
  "amount": "100000000000000000",
  "price": "3000000000000000000000",
  "success": true,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "riskCheck": {
    "passed": true,
    "currentDrawdown": 2.5,
    "projectedDrawdown": 2.7
  }
}
```

#### trade-broadcast-complete

Trade broadcast complete (to leader).

```json
{
  "tradeId": "trade-1705316000000",
  "asset": "ETH",
  "successCount": 2,
  "failureCount": 1,
  "totalCopiers": 3,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### unsubscribed

Copier unsubscribed (to copier).

```json
{
  "leaderAddress": "0x1234...",
  "reason": "manual",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### copier-left

Copier unsubscribed (to leader).

```json
{
  "copierAddress": "0x5678...",
  "reason": "max-drawdown-breached",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### risk-alert

Critical risk alert (to copier).

```json
{
  "type": "max-drawdown-breached",
  "severity": "critical",
  "sessionId": "copier-1705315900000",
  "currentDrawdown": 10.5,
  "maxDrawdown": 10,
  "message": "Max drawdown reached: 10.5% / 10%",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error Type",
  "message": "Detailed error message"
}
```

**Common Status Codes:**
- `400` Bad Request - Invalid input
- `404` Not Found - Resource not found
- `500` Internal Server Error - Server error

---

## Running the Server

### Development

```bash
npm run dev:api
```

### Production

```bash
npm run build
npm run start:api
```

### Environment Variables

Create a `.env` file:

```env
API_PORT=3001
FRONTEND_URL=http://localhost:3000
YELLOW_NETWORK_WS=wss://clearnet.yellow.com/ws
ENS_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
CHAIN_ID=1
```

---

## Testing

Use curl, Postman, or any HTTP client:

```bash
# Health check
curl http://localhost:3001/health

# Register leader
curl -X POST http://localhost:3001/api/v1/leaders/register \
  -H "Content-Type: application/json" \
  -d '{"leaderAddress":"0x1234...","ensName":"alice.shadow.eth"}'

# Get leaders
curl http://localhost:3001/api/v1/leaders
```

### WebSocket Testing

Use a WebSocket client:

```javascript
const socket = io('ws://localhost:3001');

socket.on('connect', () => {
  console.log('Connected');

  // Subscribe as observer
  socket.emit('subscribe', { type: 'observer' });
});

socket.on('leader-registered', (data) => {
  console.log('New leader:', data);
});
```
