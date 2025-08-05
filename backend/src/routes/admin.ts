import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { AdminStatsController } from '../controllers/adminStatsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Middleware to check admin role
const requireAdmin = (req: any, res: any, next: any) => {
  // Admin email addresses (configure in .env file)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || ['admin@example.com'];
  // Admin Strava IDs (configure in .env file)
  const adminStravaIds = process.env.ADMIN_STRAVA_IDS?.split(',').map(id => parseInt(id)) || [];
  
  if (!req.user) {
    return res.status(403).json({
      success: false,
      error: 'Authentication required',
    });
  }
  
  // Check if user email or Strava ID is in admin list
  // For development, also allow any authenticated user if ALLOW_ALL_ADMIN is true
  const isAdmin = process.env.ALLOW_ALL_ADMIN === 'true' || 
                  adminEmails.includes(req.user.email) ||
                  adminStravaIds.includes(req.user.stravaId);
  
  // Log for debugging
  console.log('Admin check:', {
    email: req.user.email,
    stravaId: req.user.stravaId,
    isAdmin,
    adminEmails,
    adminStravaIds,
    allowAll: process.env.ALLOW_ALL_ADMIN
  });
  
  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'You do not have permission to access admin features',
    });
  }
  
  next();
};

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Fitness threshold management routes
router.get('/threshold', AdminController.getCurrentThreshold);
router.get('/thresholds', AdminStatsController.getAllThresholds); // List all thresholds
router.put('/threshold', AdminController.updateThreshold);
router.post('/threshold/reset', AdminController.resetToDefault);
router.post('/threshold/validate', AdminController.validateThreshold);
router.get('/threshold/history', AdminController.getThresholdHistory);
router.get('/threshold/statistics', AdminController.getThresholdStatistics);

// Dashboard and stats routes
router.get('/stats', AdminStatsController.getStats);
router.get('/health', AdminStatsController.getSystemHealth);

// User management routes
router.get('/users', AdminStatsController.getUsers);
router.get('/users/:userId/fitness', AdminController.evaluateUserFitness);
router.post('/users/batch-evaluate', AdminController.batchEvaluateUsers);

export default router;