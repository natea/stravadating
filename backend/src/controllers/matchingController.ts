import { Request, Response } from 'express';
import { MatchingService } from '../services/matchingService';
import { MatchModel } from '../models/Match';
import { logger } from '../utils/logger';

export class MatchingController {
  /**
   * Get potential matches for the authenticated user
   */
  static async getPotentialMatches(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      // Validate pagination parameters
      if (limit < 1 || limit > 100) {
        res.status(400).json({ error: 'Limit must be between 1 and 100' });
        return;
      }

      if (offset < 0) {
        res.status(400).json({ error: 'Offset must be non-negative' });
        return;
      }

      const matches = await MatchingService.findPotentialMatches(userId, limit, offset);

      res.json({
        success: true,
        data: matches,
        pagination: {
          limit,
          offset,
          count: matches.length,
        },
      });
    } catch (error) {
      logger.error('Error getting potential matches:', error);
      res.status(500).json({ 
        error: 'Failed to get potential matches',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create a match (like/swipe right)
   */
  static async createMatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { targetUserId, compatibilityScore } = req.body;

      if (!targetUserId) {
        res.status(400).json({ error: 'Target user ID is required' });
        return;
      }

      if (targetUserId === userId) {
        res.status(400).json({ error: 'Cannot match with yourself' });
        return;
      }

      if (typeof compatibilityScore !== 'number' || compatibilityScore < 0 || compatibilityScore > 100) {
        res.status(400).json({ error: 'Compatibility score must be a number between 0 and 100' });
        return;
      }

      const match = await MatchingService.createMatch(userId, targetUserId, compatibilityScore);

      res.status(201).json({
        success: true,
        data: match,
        message: 'Match created successfully',
      });
    } catch (error) {
      logger.error('Error creating match:', error);
      
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(409).json({ 
          error: 'Match already exists',
          message: error.message
        });
        return;
      }

      res.status(500).json({ 
        error: 'Failed to create match',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user's matches
   */
  static async getUserMatches(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      // Validate pagination parameters
      if (page < 1) {
        res.status(400).json({ error: 'Page must be greater than 0' });
        return;
      }

      if (limit < 1 || limit > 100) {
        res.status(400).json({ error: 'Limit must be between 1 and 100' });
        return;
      }

      const matches = await MatchModel.findByUserId(userId, { page, limit });

      res.json({
        success: true,
        data: matches,
      });
    } catch (error) {
      logger.error('Error getting user matches:', error);
      res.status(500).json({ 
        error: 'Failed to get matches',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get match statistics for user
   */
  static async getMatchStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await MatchModel.getMatchStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting match stats:', error);
      res.status(500).json({ 
        error: 'Failed to get match statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Archive a match
   */
  static async archiveMatch(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { matchId } = req.params;

      if (!matchId) {
        res.status(400).json({ error: 'Match ID is required' });
        return;
      }

      // Verify user is part of this match
      const match = await MatchModel.findById(matchId);
      if (!match) {
        res.status(404).json({ error: 'Match not found' });
        return;
      }

      if (match.user1Id !== userId && match.user2Id !== userId) {
        res.status(403).json({ error: 'Not authorized to archive this match' });
        return;
      }

      const archivedMatch = await MatchModel.archive(matchId);

      res.json({
        success: true,
        data: archivedMatch,
        message: 'Match archived successfully',
      });
    } catch (error) {
      logger.error('Error archiving match:', error);
      res.status(500).json({ 
        error: 'Failed to archive match',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get user's matching preferences
   */
  static async getMatchingPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const preferences = await MatchingService.getMatchingPreferences(userId);

      res.json({
        success: true,
        data: preferences,
      });
    } catch (error) {
      logger.error('Error getting matching preferences:', error);
      res.status(500).json({ 
        error: 'Failed to get matching preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update user's matching preferences
   */
  static async updateMatchingPreferences(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { minAge, maxAge, maxDistance, preferredActivities, minCompatibilityScore } = req.body;

      // Validate input
      if (minAge !== undefined && (typeof minAge !== 'number' || minAge < 18 || minAge > 100)) {
        res.status(400).json({ error: 'Minimum age must be between 18 and 100' });
        return;
      }

      if (maxAge !== undefined && (typeof maxAge !== 'number' || maxAge < 18 || maxAge > 100)) {
        res.status(400).json({ error: 'Maximum age must be between 18 and 100' });
        return;
      }

      if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
        res.status(400).json({ error: 'Minimum age cannot be greater than maximum age' });
        return;
      }

      if (maxDistance !== undefined && (typeof maxDistance !== 'number' || maxDistance < 1 || maxDistance > 1000)) {
        res.status(400).json({ error: 'Maximum distance must be between 1 and 1000 km' });
        return;
      }

      if (preferredActivities !== undefined && !Array.isArray(preferredActivities)) {
        res.status(400).json({ error: 'Preferred activities must be an array' });
        return;
      }

      if (minCompatibilityScore !== undefined && (typeof minCompatibilityScore !== 'number' || minCompatibilityScore < 0 || minCompatibilityScore > 100)) {
        res.status(400).json({ error: 'Minimum compatibility score must be between 0 and 100' });
        return;
      }

      const preferences = await MatchingService.updateMatchingPreferences(userId, {
        minAge,
        maxAge,
        maxDistance,
        preferredActivities,
        minCompatibilityScore,
      });

      res.json({
        success: true,
        data: preferences,
        message: 'Matching preferences updated successfully',
      });
    } catch (error) {
      logger.error('Error updating matching preferences:', error);
      res.status(500).json({ 
        error: 'Failed to update matching preferences',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Calculate compatibility score between current user and target user
   */
  static async calculateCompatibility(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { targetUserId } = req.params;

      if (!targetUserId) {
        res.status(400).json({ error: 'Target user ID is required' });
        return;
      }

      if (targetUserId === userId) {
        res.status(400).json({ error: 'Cannot calculate compatibility with yourself' });
        return;
      }

      // This would require additional service methods to get user data
      // For now, we'll return a placeholder response
      res.status(501).json({ 
        error: 'Not implemented',
        message: 'Compatibility calculation endpoint not yet implemented'
      });
    } catch (error) {
      logger.error('Error calculating compatibility:', error);
      res.status(500).json({ 
        error: 'Failed to calculate compatibility',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}