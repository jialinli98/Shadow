/**
 * REST API for Shadow copy trading platform
 * Provides HTTP endpoints for all Shadow operations
 */

import express, { Router } from 'express';
import { ShadowRelay } from '../ShadowRelay';
import { SettlementService } from '../services/SettlementService';
import { OracleService } from '../services/OracleService';
import { MockMarketMaker } from '../services/MockMarketMaker';
import { TradeIntent, TradeAction } from '../types';

/**
 * Create REST API router
 */
export function createRestAPI(
  shadowRelay: ShadowRelay,
  settlementService: SettlementService,
  oracle: OracleService,
  marketMaker: MockMarketMaker
): Router {
  const router = express.Router();

  // ============================================================================
  // LEADER ENDPOINTS
  // ============================================================================

  /**
   * Register a new leader
   * POST /api/leaders/register
   */
  router.post('/leaders/register', async (req, res) => {
    try {
      const { address, ensName, performanceFee } = req.body;

      // Validate inputs
      if (!address || !ensName) {
        return res.status(400).json({ error: 'Missing required fields: address, ensName' });
      }

      if (performanceFee < 0 || performanceFee > 0.5) {
        return res.status(400).json({ error: 'Performance fee must be between 0 and 0.5 (50%)' });
      }

      await shadowRelay.registerLeader(address, ensName, performanceFee);

      res.json({
        success: true,
        leader: { address, ensName, performanceFee },
      });
    } catch (error: any) {
      console.error('Error registering leader:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get leader profile and statistics
   * GET /api/leaders/:address
   */
  router.get('/leaders/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const stats = await shadowRelay.getLeaderStats(address);

      if (!stats) {
        return res.status(404).json({ error: 'Leader not found' });
      }

      // Convert BigInt values to strings for JSON serialization
      res.json({
        ...stats,
        totalVolume: stats.totalVolume.toString(),
        totalFeesAccumulated: stats.totalFeesAccumulated.toString(),
        totalFeesSettled: stats.totalFeesSettled.toString(),
        totalFeesClaimable: stats.totalFeesClaimable.toString(),
      });
    } catch (error: any) {
      console.error('Error fetching leader:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get all leaders (leaderboard)
   * GET /api/leaders
   */
  router.get('/leaders', async (req, res) => {
    try {
      // Get all sessions and filter for leaders
      const sessions = shadowRelay.getAllSessions();
      const leaders = sessions.filter(s => s.userAddress); // Simplified

      // Get stats for each leader
      const leaderStats = await Promise.all(
        leaders.map(async (session) => {
          try {
            return await shadowRelay.getLeaderStats(session.userAddress);
          } catch {
            return null;
          }
        })
      );

      const validLeaders = leaderStats.filter(l => l !== null);

      // Convert BigInt values to strings for JSON serialization
      const formattedLeaders = validLeaders.map(stats => ({
        ...stats,
        totalVolume: stats.totalVolume.toString(),
        totalFeesAccumulated: stats.totalFeesAccumulated.toString(),
        totalFeesSettled: stats.totalFeesSettled.toString(),
        totalFeesClaimable: stats.totalFeesClaimable.toString(),
      }));

      res.json({
        leaders: formattedLeaders,
        total: formattedLeaders.length,
      });
    } catch (error: any) {
      console.error('Error fetching leaders:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // SESSION ENDPOINTS
  // ============================================================================

  /**
   * Open a Yellow Network session
   * POST /api/sessions/open
   */
  router.post('/sessions/open', async (req, res) => {
    try {
      const { userAddress, collateral } = req.body;

      if (!userAddress || !collateral) {
        return res.status(400).json({ error: 'Missing required fields: userAddress, collateral' });
      }

      const collateralBigInt = BigInt(collateral);
      const channelId = await shadowRelay.openSession(userAddress, collateralBigInt);

      res.json({
        success: true,
        channelId,
        userAddress,
        collateral: collateral.toString(),
      });
    } catch (error: any) {
      console.error('Error opening session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get session details
   * GET /api/sessions/:channelId
   */
  router.get('/sessions/:channelId', async (req, res) => {
    try {
      const { channelId } = req.params;

      // Find session by channel ID
      const sessions = shadowRelay.getAllSessions();
      const session = sessions.find(s => s.yellowChannelId === channelId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(session);
    } catch (error: any) {
      console.error('Error fetching session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get all active sessions
   * GET /api/sessions
   */
  router.get('/sessions', async (req, res) => {
    try {
      const sessions = shadowRelay.getAllSessions();
      res.json({
        sessions,
        total: sessions.length,
      });
    } catch (error: any) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // COPIER ENDPOINTS
  // ============================================================================

  /**
   * Subscribe a copier to a leader
   * POST /api/copiers/subscribe
   */
  router.post('/copiers/subscribe', async (req, res) => {
    try {
      const { copierAddress, leaderAddress, copierChannelId, performanceFee, maxDrawdown } = req.body;

      if (!copierAddress || !leaderAddress || !copierChannelId) {
        return res.status(400).json({
          error: 'Missing required fields: copierAddress, leaderAddress, copierChannelId',
        });
      }

      const relationship = await shadowRelay.subscribeCopier(
        copierAddress,
        leaderAddress,
        copierChannelId,
        performanceFee || 0.15, // Default 15%
        maxDrawdown || 10 // Default 10%
      );

      res.json({
        success: true,
        relationship: {
          id: relationship.id,
          copier: copierAddress,
          leader: leaderAddress,
          performanceFee,
          maxDrawdown,
        },
      });
    } catch (error: any) {
      console.error('Error subscribing copier:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get copier portfolio
   * GET /api/copiers/:address
   */
  router.get('/copiers/:address', async (req, res) => {
    try {
      const { address } = req.params;
      const portfolio = await shadowRelay.getCopierPortfolio(address);

      if (!portfolio) {
        return res.status(404).json({ error: 'Copier not found' });
      }

      // Convert BigInt values to strings for JSON serialization
      res.json({
        ...portfolio,
        totalDeposited: portfolio.totalDeposited.toString(),
        totalCurrentValue: portfolio.totalCurrentValue.toString(),
        totalPnL: portfolio.totalPnL.toString(),
        totalFeesOwed: portfolio.totalFeesOwed.toString(),
        relationships: portfolio.relationships.map(r => ({
          ...r,
          copierInitialDeposit: r.copierInitialDeposit.toString(),
          totalFeesAccumulated: r.totalFeesAccumulated.toString(),
          copierTotalPnL: r.copierTotalPnL.toString(),
          copierCurrentBalance: r.copierCurrentBalance.toString(),
        })),
      });
    } catch (error: any) {
      console.error('Error fetching copier:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // TRADING ENDPOINTS
  // ============================================================================

  /**
   * Execute a trade (leader only)
   * POST /api/trades/execute
   */
  router.post('/trades/execute', async (req, res) => {
    try {
      const { leaderAddress, trade, signature } = req.body;

      if (!leaderAddress || !trade || !signature) {
        return res.status(400).json({
          error: 'Missing required fields: leaderAddress, trade, signature',
        });
      }

      // Validate trade structure
      if (!trade.asset || !trade.action || !trade.amount || !trade.price) {
        return res.status(400).json({
          error: 'Invalid trade: missing asset, action, amount, or price',
        });
      }

      // Convert trade to proper format
      const tradeIntent: TradeIntent = {
        tradeId: trade.tradeId || `trade-${Date.now()}`,
        leaderAddress,
        action: trade.action as TradeAction,
        asset: trade.asset,
        tokenAddress: trade.tokenAddress || '0x0000000000000000000000000000000000000000',
        amount: BigInt(trade.amount),
        price: BigInt(trade.price),
        timestamp: Date.now(),
        yellowChannelId: trade.yellowChannelId || '',
        signature,
      };

      await shadowRelay.processTrade({
        trade: tradeIntent,
        signature,
        signer: leaderAddress,
      });

      res.json({
        success: true,
        tradeId: tradeIntent.tradeId,
        leader: leaderAddress,
        action: trade.action,
        asset: trade.asset,
      });
    } catch (error: any) {
      console.error('Error executing trade:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // SETTLEMENT ENDPOINTS
  // ============================================================================

  /**
   * Settle a copier's channel
   * POST /api/sessions/:channelId/settle
   */
  router.post('/sessions/:channelId/settle', async (req, res) => {
    try {
      const { channelId } = req.params;

      const result = await settlementService.settleChannel(channelId);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error settling channel:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Preview settlement (before executing)
   * GET /api/sessions/:channelId/settlement-preview
   */
  router.get('/sessions/:channelId/settlement-preview', async (req, res) => {
    try {
      const { channelId } = req.params;

      const preview = await settlementService.previewSettlement(channelId);

      res.json(preview);
    } catch (error: any) {
      console.error('Error previewing settlement:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // ORACLE ENDPOINTS
  // ============================================================================

  /**
   * Get current price for an asset
   * GET /api/prices/:asset
   */
  router.get('/prices/:asset', async (req, res) => {
    try {
      const { asset } = req.params;
      const priceData = await oracle.getPriceData(asset);

      res.json({
        asset: priceData.asset,
        price: priceData.price.toString(),
        formatted: oracle.formatPrice(priceData.price),
        timestamp: priceData.timestamp,
        source: priceData.source,
      });
    } catch (error: any) {
      console.error('Error fetching price:', error);
      res.status(404).json({ error: `Price not available for ${req.params.asset}` });
    }
  });

  /**
   * Get all available prices
   * GET /api/prices
   */
  router.get('/prices', async (req, res) => {
    try {
      const allPrices = oracle.getAllPrices();
      const formatted = Array.from(allPrices.entries()).map(([asset, data]) => ({
        asset,
        price: data.price.toString(),
        formatted: oracle.formatPrice(data.price),
        timestamp: data.timestamp,
      }));

      res.json({ prices: formatted });
    } catch (error: any) {
      console.error('Error fetching prices:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // MARKET MAKER ENDPOINTS
  // ============================================================================

  /**
   * Get Market Maker statistics
   * GET /api/market-maker/stats
   */
  router.get('/market-maker/stats', async (req, res) => {
    try {
      const stats = await marketMaker.getStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error fetching MM stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * Get Market Maker exposure summary
   * GET /api/market-maker/exposure
   */
  router.get('/market-maker/exposure', async (req, res) => {
    try {
      const summary = await marketMaker.getExposureSummary();

      res.json({
        positions: summary.positions.map(p => ({
          asset: p.asset,
          netPosition: p.netPosition.toString(),
          entryPrice: p.entryPrice.toString(),
          totalVolume: p.totalVolume.toString(),
          tradeCount: p.tradeCount,
        })),
        totalPnL: summary.totalPnL.toString(),
        totalVolume: summary.totalVolume.toString(),
        tradeCount: summary.tradeCount,
      });
    } catch (error: any) {
      console.error('Error fetching MM exposure:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  /**
   * Health check endpoint
   * GET /api/health
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Shadow Relay API',
      timestamp: Date.now(),
      version: '1.0.0',
    });
  });

  return router;
}
