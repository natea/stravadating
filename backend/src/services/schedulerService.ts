import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { syncService } from './syncService';

export class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Initialize all scheduled jobs
   */
  init(): void {
    this.setupDailySync();
    this.setupWeeklyCleanup();
    logger.info('Scheduler service initialized with all jobs');
  }

  /**
   * Setup daily Strava data synchronization
   * Runs every day at 2:00 AM
   */
  private setupDailySync(): void {
    const dailySyncJob = cron.schedule('0 2 * * *', async () => {
      logger.info('Starting daily Strava data synchronization');
      
      try {
        const result = await syncService.syncAllUsersActivities();
        
        logger.info('Daily sync completed', {
          totalUsers: result.totalUsers,
          successful: result.successfulSyncs,
          failed: result.failedSyncs,
        });

        // Log any failures for monitoring
        const failures = result.results.filter(r => r.error);
        if (failures.length > 0) {
          logger.warn(`Daily sync had ${failures.length} failures:`, 
            failures.map(f => ({ userId: f.userId, error: f.error }))
          );
        }
        
      } catch (error) {
        logger.error('Daily sync job failed:', error);
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'UTC',
    });

    this.jobs.set('dailySync', dailySyncJob);
    logger.info('Daily sync job scheduled for 2:00 AM UTC');
  }

  /**
   * Setup weekly cleanup for revoked Strava access
   * Runs every Sunday at 3:00 AM
   */
  private setupWeeklyCleanup(): void {
    const weeklyCleanupJob = cron.schedule('0 3 * * 0', async () => {
      logger.info('Starting weekly cleanup for revoked Strava access');
      
      try {
        const result = await syncService.cleanupRevokedUsers();
        
        logger.info('Weekly cleanup completed', {
          cleanedUsers: result.cleanedUsers,
          errors: result.errors.length,
        });

        if (result.errors.length > 0) {
          logger.warn('Weekly cleanup had errors:', result.errors);
        }
        
      } catch (error) {
        logger.error('Weekly cleanup job failed:', error);
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'UTC',
    });

    this.jobs.set('weeklyCleanup', weeklyCleanupJob);
    logger.info('Weekly cleanup job scheduled for 3:00 AM UTC on Sundays');
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`Started scheduled job: ${name}`);
    });
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped scheduled job: ${name}`);
    });
  }

  /**
   * Start a specific job
   */
  startJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`Started job: ${jobName}`);
      return true;
    }
    logger.warn(`Job not found: ${jobName}`);
    return false;
  }

  /**
   * Stop a specific job
   */
  stopJob(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`Stopped job: ${jobName}`);
      return true;
    }
    logger.warn(`Job not found: ${jobName}`);
    return false;
  }

  /**
   * Get status of all jobs
   */
  getJobsStatus(): { [jobName: string]: boolean } {
    const status: { [jobName: string]: boolean } = {};
    
    this.jobs.forEach((job, name) => {
      status[name] = (job as any).running || false;
    });

    return status;
  }

  /**
   * Manually trigger daily sync (for testing or manual execution)
   */
  async triggerDailySync(): Promise<void> {
    logger.info('Manually triggering daily sync');
    
    try {
      const result = await syncService.syncAllUsersActivities();
      logger.info('Manual daily sync completed', {
        totalUsers: result.totalUsers,
        successful: result.successfulSyncs,
        failed: result.failedSyncs,
      });
    } catch (error) {
      logger.error('Manual daily sync failed:', error);
      throw error;
    }
  }

  /**
   * Manually trigger weekly cleanup (for testing or manual execution)
   */
  async triggerWeeklyCleanup(): Promise<void> {
    logger.info('Manually triggering weekly cleanup');
    
    try {
      const result = await syncService.cleanupRevokedUsers();
      logger.info('Manual weekly cleanup completed', {
        cleanedUsers: result.cleanedUsers,
        errors: result.errors.length,
      });
    } catch (error) {
      logger.error('Manual weekly cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Add a custom scheduled job
   */
  addCustomJob(name: string, cronExpression: string, task: () => Promise<void>): boolean {
    if (this.jobs.has(name)) {
      logger.warn(`Job ${name} already exists`);
      return false;
    }

    try {
      const job = cron.schedule(cronExpression, async () => {
        logger.info(`Running custom job: ${name}`);
        try {
          await task();
          logger.info(`Custom job completed: ${name}`);
        } catch (error) {
          logger.error(`Custom job failed: ${name}`, error);
        }
      }, {
        scheduled: false,
        timezone: 'UTC',
      });

      this.jobs.set(name, job);
      logger.info(`Added custom job: ${name} with schedule: ${cronExpression}`);
      return true;
      
    } catch (error) {
      logger.error(`Failed to add custom job ${name}:`, error);
      return false;
    }
  }

  /**
   * Remove a custom job
   */
  removeCustomJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      (job as any).destroy?.();
      this.jobs.delete(name);
      logger.info(`Removed custom job: ${name}`);
      return true;
    }
    logger.warn(`Job not found: ${name}`);
    return false;
  }

  /**
   * Graceful shutdown - stop all jobs
   */
  shutdown(): void {
    logger.info('Shutting down scheduler service');
    this.stop();
    
    // Destroy all jobs
    this.jobs.forEach((job, name) => {
      (job as any).destroy?.();
      logger.debug(`Destroyed job: ${name}`);
    });
    
    this.jobs.clear();
    logger.info('Scheduler service shutdown complete');
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();