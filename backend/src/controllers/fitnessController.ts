import { Request, Response } from 'express';
import { FitnessEvaluationService } from '../services/fitnessEvaluationService';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    stravaId: number;
    email: string;
  };
}

export class FitnessController {
  /**
   * Evaluate current user's fitness for admission
   */
  static async evaluateMyFitness(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const decision = await FitnessEvaluationService.getUserAdmissionDecision(userId);

      res.json({
        success: true,
        data: {
          admitted: decision.admitted,
          score: decision.evaluation.score,
          message: decision.message,
          metrics: decision.evaluation.metrics,
          reasons: decision.evaluation.reasons,
        },
      });
    } catch (error) {
      logger.error('Failed to evaluate user fitness:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to evaluate fitness level',
      });
    }
  }

  /**
   * Get current fitness threshold (public info)
   */
  static async getThresholdInfo(_req: Request, res: Response): Promise<void> {
    try {
      const threshold = await FitnessEvaluationService.getThresholdStatistics();

      if (!threshold.currentThreshold) {
        res.status(404).json({
          success: false,
          error: 'No fitness threshold configured',
        });
        return;
      }

      // Return public threshold information (without sensitive admin data)
      res.json({
        success: true,
        data: {
          requirements: {
            weeklyDistance: threshold.currentThreshold.weeklyDistance,
            weeklyActivities: threshold.currentThreshold.weeklyActivities,
            averagePace: threshold.currentThreshold.averagePace,
            allowedActivityTypes: threshold.currentThreshold.allowedActivityTypes,
          },
          description: {
            weeklyDistance: `Minimum ${Math.round(threshold.currentThreshold.weeklyDistance / 1000)}km per week`,
            weeklyActivities: `At least ${threshold.currentThreshold.weeklyActivities} activities per week`,
            averagePace: threshold.currentThreshold.averagePace 
              ? `Average pace faster than ${Math.floor(threshold.currentThreshold.averagePace / 60)}:${Math.round(threshold.currentThreshold.averagePace % 60).toString().padStart(2, '0')}/km`
              : null,
            allowedActivityTypes: threshold.currentThreshold.allowedActivityTypes.length > 0
              ? `Activities must include: ${threshold.currentThreshold.allowedActivityTypes.join(', ')}`
              : 'All activity types accepted',
          },
        },
      });
    } catch (error) {
      logger.error('Failed to get threshold info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve threshold information',
      });
    }
  }

  /**
   * Get user's current fitness metrics (without evaluation)
   */
  static async getMyMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const evaluation = await FitnessEvaluationService.evaluateUserFitness(userId);

      res.json({
        success: true,
        data: {
          metrics: evaluation.metrics,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to get user metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve fitness metrics',
      });
    }
  }

  /**
   * Check if user meets current threshold (quick check)
   */
  static async checkEligibility(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const evaluation = await FitnessEvaluationService.evaluateUserFitness(userId);

      res.json({
        success: true,
        data: {
          eligible: evaluation.meets,
          score: evaluation.score,
          summary: evaluation.meets 
            ? 'You meet the fitness requirements!'
            : 'You do not currently meet the fitness requirements.',
        },
      });
    } catch (error) {
      logger.error('Failed to check eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check eligibility',
      });
    }
  }
}