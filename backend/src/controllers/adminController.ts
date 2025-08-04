import { Request, Response } from 'express';
import { FitnessEvaluationService, AdminThresholdUpdate } from '../services/fitnessEvaluationService';
import { FitnessThresholdModel } from '../models/FitnessThreshold';
import { logger } from '../utils/logger';

export interface AdminRequest extends Request {
  user?: {
    userId: string;
    stravaId: number;
    email: string;
  };
}

export class AdminController {
  /**
   * Get current fitness threshold
   */
  static async getCurrentThreshold(_req: AdminRequest, res: Response): Promise<void> {
    try {
      const threshold = await FitnessThresholdModel.getCurrent();
      
      if (!threshold) {
        // Initialize default threshold if none exists
        const defaultThreshold = await FitnessEvaluationService.initializeDefaultThreshold();
        res.json({
          success: true,
          data: defaultThreshold,
          message: 'Default threshold initialized',
        });
        return;
      }

      res.json({
        success: true,
        data: threshold,
      });
    } catch (error) {
      logger.error('Failed to get current threshold:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve fitness threshold',
      });
    }
  }

  /**
   * Update fitness threshold
   */
  static async updateThreshold(req: AdminRequest, res: Response): Promise<void> {
    try {
      const { weeklyDistance, weeklyActivities, averagePace, allowedActivityTypes } = req.body;
      const updatedBy = req.user?.email || 'unknown';

      const update: AdminThresholdUpdate = {
        updatedBy,
      };

      if (weeklyDistance !== undefined) update.weeklyDistance = weeklyDistance;
      if (weeklyActivities !== undefined) update.weeklyActivities = weeklyActivities;
      if (averagePace !== undefined) update.averagePace = averagePace;
      if (allowedActivityTypes !== undefined) update.allowedActivityTypes = allowedActivityTypes;

      const updatedThreshold = await FitnessEvaluationService.updateThreshold(update);

      res.json({
        success: true,
        data: updatedThreshold,
        message: 'Fitness threshold updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update threshold:', error);
      
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update fitness threshold',
        });
      }
    }
  }

  /**
   * Get threshold history
   */
  static async getThresholdHistory(req: AdminRequest, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const history = await FitnessEvaluationService.getThresholdHistory(days);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Failed to get threshold history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve threshold history',
      });
    }
  }

  /**
   * Get threshold statistics
   */
  static async getThresholdStatistics(_req: AdminRequest, res: Response): Promise<void> {
    try {
      const statistics = await FitnessEvaluationService.getThresholdStatistics();

      res.json({
        success: true,
        data: statistics,
      });
    } catch (error) {
      logger.error('Failed to get threshold statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve threshold statistics',
      });
    }
  }

  /**
   * Evaluate specific user fitness
   */
  static async evaluateUserFitness(req: AdminRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
        });
        return;
      }

      const evaluation = await FitnessEvaluationService.evaluateUserFitness(userId);

      res.json({
        success: true,
        data: evaluation,
      });
    } catch (error) {
      logger.error('Failed to evaluate user fitness:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to evaluate user fitness',
      });
    }
  }

  /**
   * Batch evaluate multiple users
   */
  static async batchEvaluateUsers(req: AdminRequest, res: Response): Promise<void> {
    try {
      const { userIds } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'User IDs array is required',
        });
        return;
      }

      if (userIds.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Maximum 100 users can be evaluated at once',
        });
        return;
      }

      const evaluations = await FitnessEvaluationService.batchEvaluateUsers(userIds);
      
      // Convert Map to object for JSON response
      const results = Object.fromEntries(evaluations);

      res.json({
        success: true,
        data: {
          evaluations: results,
          summary: {
            total: userIds.length,
            evaluated: evaluations.size,
            passed: Array.from(evaluations.values()).filter(e => e.meets).length,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to batch evaluate users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to batch evaluate users',
      });
    }
  }

  /**
   * Reset threshold to default values
   */
  static async resetToDefault(req: AdminRequest, res: Response): Promise<void> {
    try {
      const updatedBy = req.user?.email || 'unknown';
      const defaultValues = FitnessThresholdModel.getDefaultThreshold();
      
      const update: AdminThresholdUpdate = {
        weeklyDistance: defaultValues.weeklyDistance,
        weeklyActivities: defaultValues.weeklyActivities,
        averagePace: defaultValues.averagePace || undefined,
        allowedActivityTypes: defaultValues.allowedActivityTypes,
        updatedBy,
      };

      const resetThreshold = await FitnessEvaluationService.updateThreshold(update);

      res.json({
        success: true,
        data: resetThreshold,
        message: 'Fitness threshold reset to default values',
      });
    } catch (error) {
      logger.error('Failed to reset threshold:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset fitness threshold',
      });
    }
  }

  /**
   * Validate threshold values (dry run)
   */
  static async validateThreshold(req: AdminRequest, res: Response): Promise<void> {
    try {
      const { weeklyDistance, weeklyActivities, averagePace, allowedActivityTypes } = req.body;
      
      const update: AdminThresholdUpdate = {
        updatedBy: 'validation',
      };

      if (weeklyDistance !== undefined) update.weeklyDistance = weeklyDistance;
      if (weeklyActivities !== undefined) update.weeklyActivities = weeklyActivities;
      if (averagePace !== undefined) update.averagePace = averagePace;
      if (allowedActivityTypes !== undefined) update.allowedActivityTypes = allowedActivityTypes;

      // This will throw an error if validation fails
      // We don't actually save it, just validate
      try {
        await FitnessEvaluationService.updateThreshold(update);
      } catch (error) {
        throw error; // Re-throw validation errors
      }

      res.json({
        success: true,
        message: 'Threshold values are valid',
      });
    } catch (error) {
      logger.error('Threshold validation failed:', error);
      
      if (error instanceof Error) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Validation failed',
        });
      }
    }
  }
}