import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { syncService } from '../services/syncService';
import { prisma } from '../config/database';

interface StravaWebhookEvent {
  object_type: 'activity' | 'athlete';
  object_id: number;
  aspect_type: 'create' | 'update' | 'delete';
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates?: {
    title?: string;
    type?: string;
    private?: boolean;
  };
}

export class WebhookController {
  /**
   * Handle Strava webhook subscription verification
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'] as string;
      const challenge = req.query['hub.challenge'] as string;
      const verifyToken = req.query['hub.verify_token'] as string;

      logger.info('Strava webhook verification request received', {
        mode,
        challenge,
        verifyToken,
      });

      // Verify the token matches our expected value
      const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
      if (!expectedToken) {
        logger.error('STRAVA_WEBHOOK_VERIFY_TOKEN not configured');
        res.status(500).json({ error: 'Webhook verification token not configured' });
        return;
      }

      if (verifyToken !== expectedToken) {
        logger.warn('Invalid webhook verification token received', { received: verifyToken });
        res.status(403).json({ error: 'Invalid verification token' });
        return;
      }

      if (mode === 'subscribe') {
        logger.info('Webhook subscription verified successfully');
        res.json({ 'hub.challenge': challenge });
      } else {
        logger.warn('Unexpected webhook mode received', { mode });
        res.status(400).json({ error: 'Invalid mode' });
      }
      
    } catch (error) {
      logger.error('Error verifying webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Strava webhook events
   */
  async handleWebhookEvent(req: Request, res: Response): Promise<void> {
    try {
      const event: StravaWebhookEvent = req.body;

      logger.info('Strava webhook event received', {
        objectType: event.object_type,
        objectId: event.object_id,
        aspectType: event.aspect_type,
        ownerId: event.owner_id,
        eventTime: event.event_time,
      });

      // Acknowledge receipt immediately
      res.status(200).json({ status: 'received' });

      // Process the event asynchronously
      this.processWebhookEvent(event).catch(error => {
        logger.error('Error processing webhook event:', error);
      });
      
    } catch (error) {
      logger.error('Error handling webhook event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Process webhook event asynchronously
   */
  private async processWebhookEvent(event: StravaWebhookEvent): Promise<void> {
    try {
      // Only process activity events
      if (event.object_type !== 'activity') {
        logger.debug('Ignoring non-activity webhook event', { objectType: event.object_type });
        return;
      }

      // Find the user by Strava ID
      const user = await prisma.user.findUnique({
        where: { stravaId: event.owner_id },
        select: { id: true, firstName: true, lastName: true },
      });

      if (!user) {
        logger.warn('Webhook event for unknown user', { stravaId: event.owner_id });
        return;
      }

      logger.info(`Processing ${event.aspect_type} event for user ${user.id}`, {
        activityId: event.object_id,
        userId: user.id,
      });

      switch (event.aspect_type) {
        case 'create':
          await this.handleActivityCreate(user.id, event);
          break;
          
        case 'update':
          await this.handleActivityUpdate(user.id, event);
          break;
          
        case 'delete':
          await this.handleActivityDelete(user.id, event);
          break;
          
        default:
          logger.warn('Unknown webhook aspect type', { aspectType: event.aspect_type });
      }
      
    } catch (error) {
      logger.error('Error processing webhook event:', error);
    }
  }

  /**
   * Handle activity creation webhook
   */
  private async handleActivityCreate(userId: string, event: StravaWebhookEvent): Promise<void> {
    try {
      logger.info(`New activity created for user ${userId}`, { activityId: event.object_id });
      
      // Trigger incremental sync for this user to fetch the new activity
      const syncResult = await syncService.syncUserActivities(userId);
      
      if (syncResult.error) {
        logger.error(`Failed to sync new activity for user ${userId}:`, syncResult.error);
      } else {
        logger.info(`Successfully synced new activity for user ${userId}`, {
          activitiesSynced: syncResult.activitiesSynced,
          fitnessStatsUpdated: syncResult.fitnessStatsUpdated,
        });
      }
      
    } catch (error) {
      logger.error(`Error handling activity create for user ${userId}:`, error);
    }
  }

  /**
   * Handle activity update webhook
   */
  private async handleActivityUpdate(userId: string, event: StravaWebhookEvent): Promise<void> {
    try {
      logger.info(`Activity updated for user ${userId}`, { 
        activityId: event.object_id,
        updates: event.updates,
      });

      // Check if the activity became private
      if (event.updates?.private === true) {
        logger.info(`Activity ${event.object_id} became private, removing from database`);
        
        // Delete the activity from our database
        await prisma.stravaActivity.deleteMany({
          where: {
            id: event.object_id,
            userId,
          },
        });

        // Recalculate fitness stats
        await syncService.updateUserFitnessStats(userId);
        
      } else {
        // For other updates, trigger a sync to get the latest data
        const syncResult = await syncService.syncUserActivities(userId);
        
        if (syncResult.error) {
          logger.error(`Failed to sync updated activity for user ${userId}:`, syncResult.error);
        } else {
          logger.info(`Successfully synced updated activity for user ${userId}`);
        }
      }
      
    } catch (error) {
      logger.error(`Error handling activity update for user ${userId}:`, error);
    }
  }

  /**
   * Handle activity deletion webhook
   */
  private async handleActivityDelete(userId: string, event: StravaWebhookEvent): Promise<void> {
    try {
      logger.info(`Activity deleted for user ${userId}`, { activityId: event.object_id });
      
      // Delete the activity from our database
      const deleteResult = await prisma.stravaActivity.deleteMany({
        where: {
          id: event.object_id,
          userId,
        },
      });

      if (deleteResult.count > 0) {
        logger.info(`Removed deleted activity ${event.object_id} from database`);
        
        // Recalculate fitness stats after deletion
        await syncService.updateUserFitnessStats(userId);
        logger.info(`Updated fitness stats for user ${userId} after activity deletion`);
      } else {
        logger.warn(`Activity ${event.object_id} not found in database for deletion`);
      }
      
    } catch (error) {
      logger.error(`Error handling activity delete for user ${userId}:`, error);
    }
  }

  /**
   * Get webhook subscription status (for admin/monitoring)
   */
  async getWebhookStatus(_req: Request, res: Response): Promise<void> {
    try {
      // This would typically check with Strava API for subscription status
      // For now, return basic status
      const status = {
        configured: !!process.env.STRAVA_WEBHOOK_VERIFY_TOKEN,
        endpoint: `${process.env.BASE_URL || 'http://localhost:3000'}/api/webhooks/strava`,
        verifyToken: !!process.env.STRAVA_WEBHOOK_VERIFY_TOKEN,
      };

      res.json(status);
      
    } catch (error) {
      logger.error('Error getting webhook status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Manually trigger sync for a user (admin endpoint)
   */
  async triggerUserSync(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { fullResync } = req.query;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      logger.info(`Manually triggering sync for user ${userId}`, { fullResync: !!fullResync });

      let syncResult;
      if (fullResync === 'true') {
        syncResult = await syncService.forceFullResync(userId);
      } else {
        syncResult = await syncService.syncUserActivities(userId);
      }

      if (syncResult.error) {
        res.status(500).json({
          error: 'Sync failed',
          details: syncResult.error,
        });
      } else {
        res.json({
          message: 'Sync completed successfully',
          result: syncResult,
        });
      }
      
    } catch (error) {
      logger.error('Error triggering user sync:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

// Export singleton instance
export const webhookController = new WebhookController();