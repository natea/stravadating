import { Router } from 'express';
import { FitnessController } from '../controllers/fitnessController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes (no authentication required)
router.get('/threshold', FitnessController.getThresholdInfo);

// Protected routes (authentication required)
router.use(authenticateToken);
router.get('/evaluate', FitnessController.evaluateMyFitness);
router.get('/metrics', FitnessController.getMyMetrics);
router.get('/eligibility', FitnessController.checkEligibility);

export default router;