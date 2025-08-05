import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { FitnessStatsModel } from '../models/FitnessStats';
import { UserModel } from '../models/User';
import { stravaIntegrationService } from '../services/stravaIntegrationService';

const router = Router();

/**
 * @route   GET /users/fitness-stats
 * @desc    Get current user's fitness statistics
 * @access  Private
 */
router.get('/fitness-stats', authenticateToken, async (req, res): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // Get user's fitness stats from database
    const fitnessStats = await FitnessStatsModel.findByUserId(userId);

    if (!fitnessStats) {
      // If no stats exist, try to sync from Strava
      try {
        const syncResult = await stravaIntegrationService.syncUserFitnessData(userId);
        
        // Create fitness stats from sync result
        const newStats = await FitnessStatsModel.create({
          userId,
          ...syncResult.fitnessMetrics,
        });

        res.json({
          success: true,
          data: {
            weeklyDistance: newStats.weeklyDistance || 0,
            weeklyActivities: newStats.weeklyActivities || 0,
            averagePace: newStats.averagePace || null,
            favoriteActivities: newStats.favoriteActivities || [],
            totalDistance: newStats.totalDistance || 0,
            lastUpdated: new Date(),
          },
          message: 'Fitness stats synced from Strava',
        });
        return;
      } catch (syncError) {
        // If sync fails, return default stats
        res.json({
          success: true,
          data: {
            weeklyDistance: 0,
            weeklyActivities: 0,
            averagePace: null,
            favoriteActivities: [],
            totalDistance: 0,
            lastUpdated: new Date(),
          },
          message: 'No fitness data available yet',
        });
        return;
      }
    }

    res.json({
      success: true,
      data: {
        weeklyDistance: fitnessStats.weeklyDistance || 0,
        weeklyActivities: fitnessStats.weeklyActivities || 0,
        averagePace: fitnessStats.averagePace || null,
        favoriteActivities: fitnessStats.favoriteActivities || [],
        totalDistance: fitnessStats.totalDistance || 0,
        lastUpdated: new Date(),
      },
      message: 'Fitness stats retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching fitness stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch fitness stats',
      message: 'Unable to retrieve fitness statistics',
    });
  }
});

/**
 * @route   GET /users/profile/:userId
 * @desc    Get user profile by ID
 * @access  Private
 */
router.get('/profile/:userId', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await UserModel.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'User profile not found',
      });
      return;
    }

    // Get fitness stats
    const fitnessStats = await FitnessStatsModel.findByUserId(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          age: user.age,
          city: user.city,
          state: user.state,
          bio: user.bio,
          photos: user.photos,
        },
        fitnessStats: fitnessStats ? {
          weeklyDistance: fitnessStats.weeklyDistance,
          weeklyActivities: fitnessStats.weeklyActivities,
          averagePace: fitnessStats.averagePace,
          favoriteActivities: fitnessStats.favoriteActivities,
          totalDistance: fitnessStats.totalDistance,
        } : null,
      },
      message: 'User profile retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      message: 'Unable to retrieve user profile',
    });
  }
});

/**
 * @route   GET /users/recommendations
 * @desc    Get recommended matches for current user
 * @access  Private
 */
router.get('/recommendations', authenticateToken, async (req, res): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    // For now, return empty recommendations
    // This will be implemented with the matching algorithm
    res.json({
      success: true,
      data: [],
      message: 'No recommendations available yet',
    });
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recommendations',
      message: 'Unable to retrieve recommendations',
    });
  }
});

export default router;