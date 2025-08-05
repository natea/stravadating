import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export class AdminStatsController {
  /**
   * Get all thresholds (history)
   */
  static async getAllThresholds(_req: Request, res: Response): Promise<void> {
    try {
      const thresholds = await prisma.fitnessThreshold.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      res.json({
        success: true,
        data: thresholds.map(t => ({
          id: t.id,
          name: 'Fitness Threshold',
          description: 'Minimum fitness requirements for registration',
          metricType: 'distance',
          threshold: t.weeklyDistance,
          comparisonOperator: 'gte',
          timeWindowDays: 90,
          isActive: true,
          priority: 1,
          weeklyDistance: t.weeklyDistance,
          weeklyActivities: t.weeklyActivities,
          averagePace: t.averagePace,
          allowedActivityTypes: t.allowedActivityTypes,
          updatedAt: t.updatedAt,
          updatedBy: t.updatedBy,
        })),
      });
    } catch (error) {
      logger.error('Failed to get thresholds:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve thresholds',
      });
    }
  }

  /**
   * Get admin dashboard statistics
   */
  static async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const [
        totalUsers,
        totalMatches,
        totalMessages,
        recentUsers,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.match.count(),
        prisma.message.count(),
        prisma.user.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        }),
      ]);

      const activeUsers = await prisma.user.count({
        where: {
          lastActive: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      });

      const activeMatches = await prisma.match.count({
        where: {
          status: 'active',
        },
      });

      res.json({
        success: true,
        data: {
          totalUsers,
          activeUsers,
          totalMatches,
          activeMatches,
          avgCompatibilityScore: 75, // Mock value
          totalMessages,
          pendingApprovals: 0,
          dailySignups: recentUsers,
          acceptanceRate: 85, // Mock value
          averageFitnessScore: 70, // Mock value
        },
      });
    } catch (error) {
      logger.error('Failed to get stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics',
      });
    }
  }

  /**
   * Get all users with pagination
   */
  static async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip: offset,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            city: true,
            state: true,
            createdAt: true,
            lastActive: true,
            stravaId: true,
          },
        }),
        prisma.user.count(),
      ]);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve users',
      });
    }
  }

  /**
   * Get system health status
   */
  static async getSystemHealth(_req: Request, res: Response): Promise<void> {
    try {
      // Check database connection
      const dbHealthy = await prisma.$queryRaw`SELECT 1`
        .then(() => true)
        .catch(() => false);

      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime();

      res.json({
        success: true,
        data: {
          status: dbHealthy ? 'healthy' : 'degraded',
          database: {
            status: dbHealthy ? 'connected' : 'disconnected',
            latency: 5, // Mock value
          },
          server: {
            uptime: Math.floor(uptime),
            memory: {
              used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
              total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
              percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
            },
          },
          services: {
            strava: { status: 'operational', latency: 150 },
            redis: { status: 'operational', latency: 2 },
            scheduler: { status: 'operational', jobs: 2 },
          },
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get system health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve system health',
      });
    }
  }
}