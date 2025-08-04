import { Router } from 'express';
import { MatchingController } from '../controllers/matchingController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all matching routes
router.use(authMiddleware);

/**
 * @route GET /api/matching/potential
 * @desc Get potential matches for the authenticated user
 * @access Private
 * @query limit - Number of matches to return (default: 20, max: 100)
 * @query offset - Number of matches to skip (default: 0)
 */
router.get('/potential', MatchingController.getPotentialMatches);

/**
 * @route POST /api/matching/match
 * @desc Create a match (like/swipe right)
 * @access Private
 * @body targetUserId - ID of the user to match with
 * @body compatibilityScore - Calculated compatibility score (0-100)
 */
router.post('/match', MatchingController.createMatch);

/**
 * @route GET /api/matching/matches
 * @desc Get user's existing matches
 * @access Private
 * @query page - Page number (default: 1)
 * @query limit - Number of matches per page (default: 20, max: 100)
 */
router.get('/matches', MatchingController.getUserMatches);

/**
 * @route GET /api/matching/stats
 * @desc Get match statistics for the user
 * @access Private
 */
router.get('/stats', MatchingController.getMatchStats);

/**
 * @route PUT /api/matching/matches/:matchId/archive
 * @desc Archive a match
 * @access Private
 * @param matchId - ID of the match to archive
 */
router.put('/matches/:matchId/archive', MatchingController.archiveMatch);

/**
 * @route GET /api/matching/preferences
 * @desc Get user's matching preferences
 * @access Private
 */
router.get('/preferences', MatchingController.getMatchingPreferences);

/**
 * @route PUT /api/matching/preferences
 * @desc Update user's matching preferences
 * @access Private
 * @body minAge - Minimum age preference (18-100)
 * @body maxAge - Maximum age preference (18-100)
 * @body maxDistance - Maximum distance in km (1-1000)
 * @body preferredActivities - Array of preferred activity types
 * @body minCompatibilityScore - Minimum compatibility score (0-100)
 */
router.put('/preferences', MatchingController.updateMatchingPreferences);

/**
 * @route GET /api/matching/compatibility/:targetUserId
 * @desc Calculate compatibility score with target user
 * @access Private
 * @param targetUserId - ID of the user to calculate compatibility with
 */
router.get('/compatibility/:targetUserId', MatchingController.calculateCompatibility);

export default router;