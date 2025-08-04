import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { PhotoUploadService } from '../services/photoUploadService';

const router = Router();

/**
 * @route   GET /auth/strava
 * @desc    Initiate Strava OAuth flow
 * @access  Public
 */
router.get('/strava', authController.initiateStravaAuth.bind(authController));

/**
 * @route   GET /auth/strava/callback
 * @desc    Handle Strava OAuth callback
 * @access  Public
 */
router.get('/strava/callback', authController.handleStravaCallback.bind(authController));

/**
 * @route   POST /auth/refresh
 * @desc    Refresh JWT access token
 * @access  Public
 */
router.post('/refresh', authController.refreshToken.bind(authController));

/**
 * @route   POST /auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private (optional auth to handle cases where token is expired)
 */
router.post('/logout', optionalAuth, authController.logout.bind(authController));

/**
 * @route   GET /auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, authController.getProfile.bind(authController));

/**
 * @route   DELETE /auth/strava
 * @desc    Revoke Strava access and remove tokens
 * @access  Private
 */
router.delete('/strava', authenticateToken, authController.revokeStravaAccess.bind(authController));

/**
 * @route   POST /auth/strava/revoked
 * @desc    Handle Strava API access revocation
 * @access  Private
 */
router.post('/strava/revoked', authenticateToken, authController.handleStravaAccessRevoked.bind(authController));

/**
 * @route   PUT /auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticateToken, authController.updateProfile.bind(authController));

/**
 * @route   POST /auth/photos
 * @desc    Upload profile photos
 * @access  Private
 */
const upload = PhotoUploadService.getMulterConfig();
router.post('/photos', authenticateToken, upload.array('photos', 10), authController.uploadPhotos.bind(authController));

/**
 * @route   DELETE /auth/photos
 * @desc    Delete profile photo
 * @access  Private
 */
router.delete('/photos', authenticateToken, authController.deletePhoto.bind(authController));

/**
 * @route   GET /auth/registration-status/:stravaId
 * @desc    Check registration status for Strava user
 * @access  Public
 */
router.get('/registration-status/:stravaId', authController.checkRegistrationStatus.bind(authController));

export default router;