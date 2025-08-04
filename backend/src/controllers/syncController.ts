import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { syncService } from '../services/syncService';
import { schedulerService } from '../services/schedulerService';

export class SyncController {
  /**
   * Get sync status for all users
   */
  async getSyncStatus(_req: Request, res: Response): Promise<void> {
    try {
      // Get scheduler status
      const jobsStatus = schedulerService.getJobsStatus();
      
      // Get recent sync statistics (this would need to be implemented with proper logging/metrics)
      const status = {
        scheduledJobs: jobsStatus,
        lastDailySync: null, // TODO: Implement tracking of last sync times
        lastWeeklyCleanup: null, // TODO: Implement tracking of last cleanup
        totalUsers: 0, // TODO: Get from database
      };

      res.json(status);
      
    } catch (error) {
      logger.error('Error getting sync status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Manually trigger daily sync for all users
   */
  async triggerDailySync(_req: Request, res: Response): Promise<void> {
    try {
      logger.info('Admin triggered daily sync');
      
      // Trigger the sync asynchronously
      schedulerService.triggerDailySync().catch(error => {
        logger.error('Daily sync failed:', error);
      });

      res.json({ 
        message: 'Daily sync triggered successfully',
        status: 'running',
      });
      
    } catch (error) {
      logger.error('Error triggering daily sync:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Manually trigger weekly cleanup
   */
  async triggerWeeklyCleanup(_req: Request, res: Response): Promise<void> {
    try {
      logger.info('Admin triggered weekly cleanup');
      
      // Trigger the cleanup asynchronously
      schedulerService.triggerWeeklyCleanup().catch(error => {
        logger.error('Weekly cleanup failed:', error);
      });

      res.json({ 
        message: 'Weekly cleanup triggered successfully',
        status: 'running',
      });
      
    } catch (error) {
      logger.error('Error triggering weekly cleanup:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Sync activities for a specific user
   */
  async syncUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { fullResync } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      logger.info(`Admin triggered sync for user ${userId}`, { fullResync: !!fullResync });

      let result;
      if (fullResync === 'true') {
        result = await syncService.forceFullResync(userId);
      } else {
        result = await syncService.syncUserActivities(userId);
      }

      if (result.error) {
        res.status(500).json({
          error: 'Sync failed',
          details: result.error,
        });
      } else {
        res.json({
          message: 'User sync completed successfully',
          result,
        });
      }
      
    } catch (error) {
      logger.error('Error syncing user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update fitness stats for a specific user
   */
  async updateUserFitnessStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      logger.info(`Admin triggered fitness stats update for user ${userId}`);

      await syncService.updateUserFitnessStats(userId);

      res.json({
        message: 'Fitness stats updated successfully',
        userId,
      });
      
    } catch (error) {
      logger.error('Error updating fitness stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Clean up data for users who revoked Strava access
   */
  async cleanupRevokedUsers(_req: Request, res: Response): Promise<void> {
    try {
      logger.info('Admin triggered cleanup of revoked users');

      const result = await syncService.cleanupRevokedUsers();

      res.json({
        message: 'Cleanup completed',
        result,
      });
      
    } catch (error) {
      logger.error('Error cleaning up revoked users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Clean up data for a specific user
   */
  async cleanupUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      logger.info(`Admin triggered cleanup for user ${userId}`);

      await syncService.cleanupUserStravaData(userId);

      res.json({
        message: 'User data cleaned up successfully',
        userId,
      });
      
    } catch (error) {
      logger.error('Error cleaning up user data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Start scheduled jobs
   */
  async startScheduledJobs(_req: Request, res: Response): Promise<void> {
    try {
      schedulerService.start();
      
      res.json({
        message: 'Scheduled jobs started successfully',
        status: schedulerService.getJobsStatus(),
      });
      
    } catch (error) {
      logger.error('Error starting scheduled jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Stop scheduled jobs
   */
  async stopScheduledJobs(_req: Request, res: Response): Promise<void> {
    try {
      schedulerService.stop();
      
      res.json({
        message: 'Scheduled jobs stopped successfully',
        status: schedulerService.getJobsStatus(),
      });
      
    } catch (error) {
      logger.error('Error stopping scheduled jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Start a specific scheduled job
   */
  async startJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobName } = req.params;

      if (!jobName) {
        res.status(400).json({ error: 'Job name is required' });
        return;
      }

      const success = schedulerService.startJob(jobName);
      
      if (success) {
        res.json({
          message: `Job ${jobName} started successfully`,
          status: schedulerService.getJobsStatus(),
        });
      } else {
        res.status(404).json({ error: `Job ${jobName} not found` });
      }
      
    } catch (error) {
      logger.error('Error starting job:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Stop a specific scheduled job
   */
  async stopJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobName } = req.params;

      if (!jobName) {
        res.status(400).json({ error: 'Job name is required' });
        return;
      }

      const success = schedulerService.stopJob(jobName);
      
      if (success) {
        res.json({
          message: `Job ${jobName} stopped successfully`,
          status: schedulerService.getJobsStatus(),
        });
      } else {
        res.status(404).json({ error: `Job ${jobName} not found` });
      }
      
    } catch (error) {
      logger.error('Error stopping job:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

// Export singleton instance
export const syncController = new SyncController();