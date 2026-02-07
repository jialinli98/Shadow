/**
 * Leader API Routes
 * Endpoints for trader leaders to register and manage their profile
 */

import { Router, Request, Response } from 'express';
import { YellowService } from '../../services/YellowService';
import { ENSService } from '../../services/ENSService';
import { RiskManager } from '../../services/RiskManager';
import { ReplicationService } from '../../services/ReplicationService';

interface Services {
  yellowService: YellowService;
  ensService: ENSService;
  riskManager: RiskManager;
  replicationService: ReplicationService;
}

export function setupLeaderRoutes(router: Router, services: Services): void {
  const { replicationService, ensService } = services;

  /**
   * POST /api/v1/leaders/register
   * Register a new leader trader
   */
  router.post('/leaders/register', async (req: Request, res: Response) => {
    try {
      const { leaderAddress, ensName } = req.body;

      if (!leaderAddress || !ensName) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'leaderAddress and ensName are required',
        });
      }

      console.log('📝 Registering leader:', { leaderAddress, ensName });

      // Verify ENS name ownership (optional but recommended)
      const resolvedAddress = await ensService.resolveENSName(ensName);
      if (resolvedAddress && resolvedAddress.toLowerCase() !== leaderAddress.toLowerCase()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'ENS name does not resolve to provided address',
        });
      }

      // Register leader session
      const session = replicationService.registerLeaderSession({
        sessionId: `leader-${Date.now()}`,
        leaderAddress,
        ensName,
        yellowChannelId: '',
        isActive: true,
        copiers: [],
        totalCopiers: 0,
        totalVolumeReplicated: BigInt(0),
        totalFeesEarned: BigInt(0),
        registeredAt: Date.now(),
      });

      // Get ENS profile
      const profile = await ensService.getLeaderProfile(ensName);

      res.status(201).json({
        success: true,
        session: {
          sessionId: session.sessionId,
          leaderAddress: session.leaderAddress,
          ensName: session.ensName,
          isActive: session.isActive,
          registeredAt: session.registeredAt,
        },
        profile,
      });
    } catch (error) {
      console.error('❌ Error registering leader:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/leaders/:address
   * Get leader profile and session details
   */
  router.get('/leaders/:address', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      console.log('🔍 Fetching leader profile:', address);

      // Get leader session
      const session = replicationService.getLeaderSessions().get(address);
      if (!session) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Leader not found',
        });
      }

      // Get ENS profile
      const profile = await ensService.getLeaderProfile(session.ensName);

      // Get active copiers
      const copiers = replicationService.getCopiersByLeader(address);
      const activeCopiers = copiers.filter(c => c.isActive);

      res.json({
        success: true,
        session: {
          sessionId: session.sessionId,
          leaderAddress: session.leaderAddress,
          ensName: session.ensName,
          isActive: session.isActive,
          registeredAt: session.registeredAt,
          totalCopiers: session.totalCopiers,
          activeCopiers: activeCopiers.length,
          totalVolumeReplicated: session.totalVolumeReplicated.toString(),
          totalFeesEarned: session.totalFeesEarned.toString(),
        },
        profile,
        copiers: activeCopiers.map(c => ({
          copierAddress: c.copierAddress,
          depositAmount: c.depositAmount.toString(),
          maxDrawdown: c.maxDrawdown,
          currentValue: c.currentValue.toString(),
          startedAt: c.startedAt,
        })),
      });
    } catch (error) {
      console.error('❌ Error fetching leader:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/leaders
   * List all registered leaders
   */
  router.get('/leaders', async (req: Request, res: Response) => {
    try {
      console.log('🔍 Fetching all leaders');

      const leaders = Array.from(replicationService.getLeaderSessions().values());

      // Get basic profiles for all leaders
      const leadersWithProfiles = await Promise.all(
        leaders.map(async (session) => {
          const profile = await ensService.getLeaderProfile(session.ensName);
          const copiers = replicationService.getCopiersByLeader(session.leaderAddress);
          const activeCopiers = copiers.filter(c => c.isActive);

          return {
            leaderAddress: session.leaderAddress,
            ensName: session.ensName,
            isActive: session.isActive,
            totalCopiers: session.totalCopiers,
            activeCopiers: activeCopiers.length,
            totalVolumeReplicated: session.totalVolumeReplicated.toString(),
            totalFeesEarned: session.totalFeesEarned.toString(),
            registeredAt: session.registeredAt,
            profile: profile ? {
              ensName: profile.ensName,
              avatar: profile.avatar,
              bio: profile.bio,
            } : null,
          };
        })
      );

      res.json({
        success: true,
        count: leadersWithProfiles.length,
        leaders: leadersWithProfiles,
      });
    } catch (error) {
      console.error('❌ Error fetching leaders:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/v1/leaders/:address/stats
   * Get leader statistics
   */
  router.get('/leaders/:address/stats', async (req: Request, res: Response) => {
    try {
      const { address } = req.params;

      console.log('📊 Fetching leader stats:', address);

      const stats = replicationService.getStats(address);

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('❌ Error fetching stats:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
