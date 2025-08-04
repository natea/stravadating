import { Router } from 'express';
import { webhookController } from '../controllers/webhookController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * Strava webhook verification endpoint
 * GET /api/webhooks/strava
 * Used by Strava to verify webhook subscription
 */
router.get('/strava', webhookController.verifyWebhook.bind(webhookController));

/**
 * Strava webhook event endpoint
 * POST /api/webhooks/strava
 * Receives real-time activity updates from Strava
 */
router.post('/strava', webhookController.handleWebhookEvent.bind(webhookController));

/**
 * Get webhook status (admin only)
 * GET /api/webhooks/status
 */
router.get('/status', authenticateToken, webhookController.getWebhookStatus.bind(webhookController));

/**
 * Manually trigger user sync (admin only)
 * POST /api/webhooks/sync/:userId
 * Query params: fullResync=true for full resync
 */
router.post('/sync/:userId', authenticateToken, webhookController.triggerUserSync.bind(webhookController));

export { router as webhookRoutes };