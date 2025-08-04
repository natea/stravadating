import { Router } from 'express';
import { AdminController } from '../controllers/adminController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Middleware to check admin role (placeholder - implement based on your auth system)
const requireAdmin = (req: any, res: any, next: any) => {
  // TODO: Implement proper admin role checking
  // For now, just check if user is authenticated
  if (!req.user) {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
  }
  next();
};

// Apply authentication and admin middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// Fitness threshold management routes
router.get('/threshold', AdminController.getCurrentThreshold);
router.put('/threshold', AdminController.updateThreshold);
router.post('/threshold/reset', AdminController.resetToDefault);
router.post('/threshold/validate', AdminController.validateThreshold);
router.get('/threshold/history', AdminController.getThresholdHistory);
router.get('/threshold/statistics', AdminController.getThresholdStatistics);

// User evaluation routes
router.get('/users/:userId/fitness', AdminController.evaluateUserFitness);
router.post('/users/batch-evaluate', AdminController.batchEvaluateUsers);

export default router;