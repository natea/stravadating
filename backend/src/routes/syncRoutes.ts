import { Router } from 'express';
import { syncController } from '../controllers/syncController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All sync routes require authentication (admin only)
router.use(authenticateToken);

/**
 * Get sync status
 * GET /api/sync/status
 */
router.get('/status', syncController.getSyncStatus.bind(syncController));

/**
 * Manually trigger daily sync for all users
 * POST /api/sync/daily
 */
router.post('/daily', syncController.triggerDailySync.bind(syncController));

/**
 * Manually trigger weekly cleanup
 * POST /api/sync/cleanup
 */
router.post('/cleanup', syncController.triggerWeeklyCleanup.bind(syncController));

/**
 * Sync activities for a specific user
 * POST /api/sync/user/:userId
 * Query params: fullResync=true for full resync
 */
router.post('/user/:userId', syncController.syncUser.bind(syncController));

/**
 * Update fitness stats for a specific user
 * POST /api/sync/user/:userId/fitness-stats
 */
router.post('/user/:userId/fitness-stats', syncController.updateUserFitnessStats.bind(syncController));

/**
 * Clean up data for users who revoked Strava access
 * POST /api/sync/cleanup/revoked
 */
router.post('/cleanup/revoked', syncController.cleanupRevokedUsers.bind(syncController));

/**
 * Clean up data for a specific user
 * DELETE /api/sync/user/:userId/cleanup
 */
router.delete('/user/:userId/cleanup', syncController.cleanupUser.bind(syncController));

/**
 * Scheduled jobs management
 */

/**
 * Start all scheduled jobs
 * POST /api/sync/jobs/start
 */
router.post('/jobs/start', syncController.startScheduledJobs.bind(syncController));

/**
 * Stop all scheduled jobs
 * POST /api/sync/jobs/stop
 */
router.post('/jobs/stop', syncController.stopScheduledJobs.bind(syncController));

/**
 * Start a specific scheduled job
 * POST /api/sync/jobs/:jobName/start
 */
router.post('/jobs/:jobName/start', syncController.startJob.bind(syncController));

/**
 * Stop a specific scheduled job
 * POST /api/sync/jobs/:jobName/stop
 */
router.post('/jobs/:jobName/stop', syncController.stopJob.bind(syncController));

export { router as syncRoutes };