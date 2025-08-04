import { logger } from '../utils/logger';
import { stravaService } from './stravaService';
import { StravaActivityModel } from '../models/StravaActivity';
import { FitnessStatsModel } from '../models/FitnessStats';
import { prisma } from '../config/database';

export interface SyncResult {
  userId: string;
  activitiesSynced: number;
  fitnessStatsUpdated: boolean;
  error?: string;
}

export interface BulkSyncResult {
  totalUsers: number;
  successfulSyncs: number;
  failedSyncs: number;
  results: SyncResult[];
}

export class SyncService {
  /**
   * Sync activities for a single user incrementally
   */
  async syncUserActivities(userId: string): Promise<SyncResult> {
    const result: SyncResult = {
      userId,
      activitiesSynced: 0,
      fitnessStatsUpdated: false,
    };

    try {
      // Get user with Strava tokens
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          fitnessStats: true,
        },
      });

      if (!user) {
        result.error = 'User not found';
        return result;
      }

      // Get user's Strava tokens (assuming they're stored in a separate table or service)
      const tokens = await this.getUserStravaTokens(userId);
      if (!tokens) {
        result.error = 'No Strava tokens found for user';
        return result;
      }

      // Get the last sync date to fetch only new activities
      const lastSyncDate = user.fitnessStats?.lastSyncDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      // Fetch new activities since last sync
      const newActivities = await stravaService!.fetchAthleteActivities(
        tokens.accessToken,
        lastSyncDate,
        undefined,
        1,
        200
      );

      if (newActivities.length === 0) {
        logger.info(`No new activities found for user ${userId}`);
        return result;
      }

      // Transform activities to include userId
      const activitiesWithUserId = newActivities.map(activity => ({
        ...activity,
        userId,
      }));

      // Bulk insert new activities
      const insertedCount = await StravaActivityModel.createMany(activitiesWithUserId);
      result.activitiesSynced = insertedCount;

      // Recalculate fitness stats with all activities from last 90 days
      await this.updateUserFitnessStats(userId);
      result.fitnessStatsUpdated = true;

      logger.info(`Successfully synced ${insertedCount} activities for user ${userId}`);
      
    } catch (error) {
      logger.error(`Failed to sync activities for user ${userId}:`, error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  }

  /**
   * Sync activities for all users (daily batch job)
   */
  async syncAllUsersActivities(): Promise<BulkSyncResult> {
    const bulkResult: BulkSyncResult = {
      totalUsers: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      results: [],
    };

    try {
      // Get all users who have Strava integration
      const users = await prisma.user.findMany({
        where: {
          stravaId: {
            gt: 0,
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      });

      bulkResult.totalUsers = users.length;
      logger.info(`Starting bulk sync for ${users.length} users`);

      // Process users in batches to avoid overwhelming Strava API
      const batchSize = 10;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        
        // Process batch concurrently but with rate limiting
        const batchPromises = batch.map(async (user, index) => {
          // Add delay between requests to respect rate limits
          await this.delay(index * 1000);
          return this.syncUserActivities(user.id);
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            bulkResult.results.push(result.value);
            if (result.value.error) {
              bulkResult.failedSyncs++;
            } else {
              bulkResult.successfulSyncs++;
            }
          } else {
            bulkResult.failedSyncs++;
            bulkResult.results.push({
              userId: batch[index].id,
              activitiesSynced: 0,
              fitnessStatsUpdated: false,
              error: result.reason?.message || 'Unknown error',
            });
          }
        });

        // Add delay between batches
        if (i + batchSize < users.length) {
          await this.delay(5000);
        }
      }

      logger.info(`Bulk sync completed: ${bulkResult.successfulSyncs} successful, ${bulkResult.failedSyncs} failed`);
      
    } catch (error) {
      logger.error('Failed to complete bulk sync:', error);
    }

    return bulkResult;
  }

  /**
   * Update fitness statistics for a user based on their activities
   */
  async updateUserFitnessStats(userId: string): Promise<void> {
    try {
      // Get activities from last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const activities = await StravaActivityModel.findByUserIdAndDateRange(
        userId,
        ninetyDaysAgo,
        new Date()
      );

      // Calculate fitness metrics
      const fitnessMetrics = stravaService!.calculateFitnessMetrics(activities);

      // Update or create fitness stats
      await FitnessStatsModel.upsert(userId, {
        userId,
        ...fitnessMetrics,
      });

      logger.debug(`Updated fitness stats for user ${userId}`);
      
    } catch (error) {
      logger.error(`Failed to update fitness stats for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up data for users who have revoked Strava access
   */
  async cleanupRevokedUsers(): Promise<{ cleanedUsers: number; errors: string[] }> {
    const result = {
      cleanedUsers: 0,
      errors: [] as string[],
    };

    try {
      // Get all users with Strava integration
      const users = await prisma.user.findMany({
        where: {
          stravaId: {
            gt: 0,
          },
        },
        select: {
          id: true,
          stravaId: true,
        },
      });

      for (const user of users) {
        try {
          const tokens = await this.getUserStravaTokens(user.id);
          if (!tokens) {
            continue;
          }

          // Try to fetch athlete profile to check if access is still valid
          await stravaService!.fetchAthleteProfile(tokens.accessToken);
          
        } catch (error) {
          // If we get a 401 or 403, the user has likely revoked access
          if (error instanceof Error && (error.message.includes('401') || error.message.includes('403'))) {
            logger.info(`Cleaning up data for user ${user.id} - Strava access revoked`);
            
            try {
              await this.cleanupUserStravaData(user.id);
              result.cleanedUsers++;
            } catch (cleanupError) {
              const errorMsg = `Failed to cleanup user ${user.id}: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`;
              result.errors.push(errorMsg);
              logger.error(errorMsg);
            }
          }
        }

        // Add delay to respect rate limits
        await this.delay(1000);
      }

      logger.info(`Cleanup completed: ${result.cleanedUsers} users cleaned, ${result.errors.length} errors`);
      
    } catch (error) {
      const errorMsg = `Failed to complete cleanup process: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      logger.error(errorMsg);
    }

    return result;
  }

  /**
   * Clean up all Strava-related data for a user
   */
  async cleanupUserStravaData(userId: string): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        // Delete Strava activities
        await tx.stravaActivity.deleteMany({
          where: { userId },
        });

        // Delete fitness stats
        await tx.fitnessStats.deleteMany({
          where: { userId },
        });

        // Remove Strava tokens (if stored in database)
        // This would depend on your token storage implementation
        await this.removeUserStravaTokens(userId);

        // Optionally, you might want to keep the user account but mark it as disconnected
        // await tx.user.update({
        //   where: { id: userId },
        //   data: { stravaId: null },
        // });
      });

      logger.info(`Successfully cleaned up Strava data for user ${userId}`);
      
    } catch (error) {
      logger.error(`Failed to cleanup Strava data for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Force full resync for a user (fetch all activities from last 90 days)
   */
  async forceFullResync(userId: string): Promise<SyncResult> {
    const result: SyncResult = {
      userId,
      activitiesSynced: 0,
      fitnessStatsUpdated: false,
    };

    try {
      // Get user's Strava tokens
      const tokens = await this.getUserStravaTokens(userId);
      if (!tokens) {
        result.error = 'No Strava tokens found for user';
        return result;
      }

      // Delete existing activities for this user
      await StravaActivityModel.deleteByUserId(userId);

      // Fetch all activities from last 90 days
      const activities = await stravaService!.fetchLast90DaysActivities(tokens.accessToken);

      if (activities.length === 0) {
        logger.info(`No activities found for user ${userId} during full resync`);
        return result;
      }

      // Transform activities to include userId
      const activitiesWithUserId = activities.map(activity => ({
        ...activity,
        userId,
      }));

      // Bulk insert activities
      const insertedCount = await StravaActivityModel.createMany(activitiesWithUserId);
      result.activitiesSynced = insertedCount;

      // Recalculate fitness stats
      await this.updateUserFitnessStats(userId);
      result.fitnessStatsUpdated = true;

      logger.info(`Successfully completed full resync for user ${userId}: ${insertedCount} activities`);
      
    } catch (error) {
      logger.error(`Failed to complete full resync for user ${userId}:`, error);
      result.error = error instanceof Error ? error.message : 'Unknown error';
    }

    return result;
  }

  /**
   * Get Strava tokens for a user
   * This is a placeholder - implement based on your token storage strategy
   */
  private async getUserStravaTokens(_userId: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    // TODO: Implement based on your token storage strategy
    // This could be in a separate tokens table, Redis, or encrypted in user table
    // For now, returning null to indicate tokens need to be implemented
    return null;
  }

  /**
   * Remove Strava tokens for a user
   * This is a placeholder - implement based on your token storage strategy
   */
  private async removeUserStravaTokens(userId: string): Promise<void> {
    // TODO: Implement based on your token storage strategy
    logger.debug(`Removing Strava tokens for user ${userId}`);
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const syncService = new SyncService();