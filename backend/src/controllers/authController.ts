import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { tokenService } from '../services/tokenService';
import { UserRegistrationService } from '../services/userRegistrationService';
import { PhotoUploadService } from '../services/photoUploadService';
import { UserModel } from '../models/User';
import { StravaTokens } from '../types/strava';
import { User } from '../types/user';

export class AuthController {
  /**
   * Initiate Strava OAuth flow
   */
  async initiateStravaAuth(_req: Request, res: Response): Promise<void> {
    try {
      // Generate a random state parameter for CSRF protection
      const state = Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);
      
      // Store state in session or return it to client to verify later
      const authUrl = authService.generateStravaAuthUrl(state);
      
      res.json({
        success: true,
        data: {
          authUrl,
          state,
        },
        message: 'Strava authorization URL generated successfully',
      });
    } catch (error) {
      console.error('Error initiating Strava auth:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to initiate Strava authentication',
      });
    }
  }

  /**
   * Handle Strava OAuth callback
   */
  async handleStravaCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error } = req.query;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      // Handle OAuth errors - redirect to frontend with error
      if (error) {
        res.redirect(`${frontendUrl}/auth/callback?error=${error}&state=${state || ''}`);
        return;
      }

      // Validate required parameters - redirect to frontend with error
      if (!code || typeof code !== 'string') {
        res.redirect(`${frontendUrl}/auth/callback?error=missing_code&state=${state || ''}`);
        return;
      }

      // Redirect to frontend with code and state
      // The frontend will then make an API call to complete the authentication
      res.redirect(`${frontendUrl}/auth/callback?code=${code}&state=${state || ''}`);
    } catch (error) {
      console.error('Error in Strava callback:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth/callback?error=server_error`);
    }
  }

  /**
   * Complete Strava authentication after redirect
   * This is called by the frontend after being redirected from Strava
   */
  async completeStravaAuth(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.query;

      // Validate required parameters
      if (!code || typeof code !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Missing authorization code',
          message: 'Authorization code is required',
        });
        return;
      }

      // Log the attempt
      console.log(`Attempting to exchange code: ${code.substring(0, 10)}...`);
      
      // Exchange code for tokens
      let stravaResponse;
      try {
        stravaResponse = await authService.exchangeCodeForTokens(code);
      } catch (error: any) {
        // If code exchange fails, it might be because code was already used
        console.error('Code exchange failed:', error.message);
        
        // Check if it's specifically a bad request (code already used)
        if (error.message?.includes('Bad Request')) {
          res.status(400).json({
            success: false,
            error: 'AUTH_CODE_ALREADY_USED',
            message: 'This authorization code has already been used. Please go back to the login page and try again.',
          });
        } else {
          res.status(400).json({
            success: false,
            error: 'AUTH_CODE_INVALID',
            message: 'Authorization failed. Please try logging in again.',
          });
        }
        return;
      }
      
      // Check if user already exists
      const existingUser = await UserModel.findByStravaId(stravaResponse.athlete.id);
      
      if (existingUser) {
        // User exists - proceed with login
        const stravaTokens: StravaTokens = {
          accessToken: stravaResponse.access_token,
          refreshToken: stravaResponse.refresh_token,
          expiresAt: Math.floor(Date.now() / 1000) + 21600,
        };
        
        await tokenService.storeStravaTokens(existingUser.id, stravaTokens);

        // Generate JWT tokens
        const accessToken = authService.generateAccessToken(existingUser);
        const refreshToken = authService.generateRefreshToken(existingUser);

        // Store user session
        await tokenService.storeUserSession(existingUser.id, {
          lastLogin: new Date(),
          stravaConnected: true,
        });

        res.json({
          success: true,
          data: {
            user: {
              id: existingUser.id,
              email: existingUser.email,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              stravaId: existingUser.stravaId,
            },
            tokens: {
              accessToken,
              refreshToken,
              expiresIn: process.env.JWT_EXPIRES_IN || '1h',
            },
          },
          message: 'Login successful',
        });
        return;
      }

      // New user - proceed with registration
      const registrationResult = await UserRegistrationService.registerUser({
        stravaAuthResponse: stravaResponse,
      });

      if (!registrationResult.success) {
        res.status(400).json({
          success: false,
          error: registrationResult.error,
          message: registrationResult.message,
          data: {
            fitnessEvaluation: registrationResult.fitnessEvaluation,
          },
        });
        return;
      }

      const user = registrationResult.user!;

      // Generate JWT tokens
      const accessToken = authService.generateAccessToken(user);
      const refreshToken = authService.generateRefreshToken(user);

      // Store user session
      await tokenService.storeUserSession(user.id, {
        lastLogin: new Date(),
        stravaConnected: true,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            stravaId: user.stravaId,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '1h',
          },
          fitnessEvaluation: registrationResult.fitnessEvaluation,
        },
        message: registrationResult.message,
      });
    } catch (error) {
      console.error('Error handling Strava callback:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication failed',
        message: error instanceof Error ? error.message : 'Failed to complete authentication',
      });
    }
  }

  /**
   * Refresh JWT access token using refresh token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Missing refresh token',
          message: 'Refresh token is required',
        });
        return;
      }

      // Check if token is blacklisted
      const isBlacklisted = await tokenService.isRefreshTokenBlacklisted(refreshToken);
      if (isBlacklisted) {
        res.status(401).json({
          success: false,
          error: 'Invalid refresh token',
          message: 'Refresh token has been revoked',
        });
        return;
      }

      // Verify refresh token
      const payload = authService.verifyRefreshToken(refreshToken);
      
      // TODO: Fetch user from database using payload.userId
      // For now, we'll create a mock user
      const mockUser: User = {
        id: payload.userId,
        email: 'user@example.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: '',
        photos: [],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      // Generate new tokens
      const newAccessToken = authService.generateAccessToken(mockUser);
      const newRefreshToken = authService.generateRefreshToken(mockUser);

      // Blacklist old refresh token
      await tokenService.blacklistRefreshToken(refreshToken);

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        },
        message: 'Token refreshed successfully',
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      res.status(401).json({
        success: false,
        error: 'Token refresh failed',
        message: error instanceof Error ? error.message : 'Failed to refresh token',
      });
    }
  }

  /**
   * Logout user and invalidate tokens
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.userId;

      if (refreshToken) {
        // Blacklist refresh token
        await tokenService.blacklistRefreshToken(refreshToken);
      }

      if (userId) {
        // Remove user session
        await tokenService.removeUserSession(userId);
      }

      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        message: 'Failed to logout user',
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
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

      // Fetch user from database
      const user = await UserModel.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found',
        });
        return;
      }

      // Get session data
      const sessionData = await tokenService.getUserSession(userId);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            stravaId: user.stravaId,
            age: user.age,
            gender: user.gender,
            city: user.city,
            state: user.state,
            bio: user.bio,
            photos: user.photos,
            lastActive: user.lastActive,
            createdAt: user.createdAt,
          },
          session: sessionData,
        },
        message: 'Profile retrieved successfully',
      });
    } catch (error) {
      console.error('Error getting profile:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile',
        message: 'Unable to retrieve user profile',
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
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

      const { age, bio, city, state, gender } = req.body;

      const updatedUser = await UserRegistrationService.updateUserProfile(userId, {
        age,
        bio,
        city,
        state,
        gender,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            age: updatedUser.age,
            gender: updatedUser.gender,
            city: updatedUser.city,
            state: updatedUser.state,
            bio: updatedUser.bio,
            photos: updatedUser.photos,
          },
        },
        message: 'Profile updated successfully',
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(400).json({
        success: false,
        error: 'Profile update failed',
        message: error instanceof Error ? error.message : 'Failed to update profile',
      });
    }
  }

  /**
   * Upload profile photos
   */
  async uploadPhotos(req: Request, res: Response): Promise<void> {
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

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No files provided',
          message: 'At least one photo file is required',
        });
        return;
      }

      // Validate files
      for (const file of files) {
        const validation = PhotoUploadService.validatePhotoFile(file);
        if (!validation.isValid) {
          res.status(400).json({
            success: false,
            error: 'Invalid file',
            message: validation.error,
          });
          return;
        }
      }

      // Process photos
      const uploadResults = await PhotoUploadService.processMultiplePhotos(files, userId);

      // Check for failures
      const failedUploads = uploadResults.filter(result => !result.success);
      if (failedUploads.length > 0) {
        res.status(500).json({
          success: false,
          error: 'Photo upload failed',
          message: `Failed to upload ${failedUploads.length} photos`,
          data: { results: uploadResults },
        });
        return;
      }

      // Get current user photos
      const user = await UserModel.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User not found',
        });
        return;
      }

      // Add new photo URLs to user profile
      const newPhotoUrls = uploadResults.map(result => result.photoUrl!);
      const updatedPhotos = [...(user.photos as string[]), ...newPhotoUrls].slice(0, 10); // Limit to 10 photos

      await UserModel.update(userId, { photos: updatedPhotos });

      res.json({
        success: true,
        data: {
          uploadedPhotos: uploadResults,
          totalPhotos: updatedPhotos.length,
        },
        message: `Successfully uploaded ${uploadResults.length} photos`,
      });
    } catch (error) {
      console.error('Error uploading photos:', error);
      res.status(500).json({
        success: false,
        error: 'Photo upload failed',
        message: error instanceof Error ? error.message : 'Failed to upload photos',
      });
    }
  }

  /**
   * Delete profile photo
   */
  async deletePhoto(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { photoUrl } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      if (!photoUrl) {
        res.status(400).json({
          success: false,
          error: 'Missing photo URL',
          message: 'Photo URL is required',
        });
        return;
      }

      // Get current user
      const user = await UserModel.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User not found',
        });
        return;
      }

      // Check if photo belongs to user
      const userPhotos = user.photos as string[];
      if (!userPhotos.includes(photoUrl)) {
        res.status(403).json({
          success: false,
          error: 'Unauthorized',
          message: 'Photo does not belong to user',
        });
        return;
      }

      // Delete photo file
      await PhotoUploadService.deletePhoto(photoUrl);

      // Remove from user profile
      const updatedPhotos = userPhotos.filter(url => url !== photoUrl);
      await UserModel.update(userId, { photos: updatedPhotos });

      res.json({
        success: true,
        message: 'Photo deleted successfully',
        data: {
          remainingPhotos: updatedPhotos.length,
        },
      });
    } catch (error) {
      console.error('Error deleting photo:', error);
      res.status(500).json({
        success: false,
        error: 'Photo deletion failed',
        message: error instanceof Error ? error.message : 'Failed to delete photo',
      });
    }
  }

  /**
   * Check registration status for Strava user
   */
  async checkRegistrationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { stravaId } = req.params;

      if (!stravaId || isNaN(Number(stravaId))) {
        res.status(400).json({
          success: false,
          error: 'Invalid Strava ID',
          message: 'Valid Strava ID is required',
        });
        return;
      }

      const status = await UserRegistrationService.getRegistrationStatus(Number(stravaId));

      res.json({
        success: true,
        data: status,
        message: 'Registration status retrieved successfully',
      });
    } catch (error) {
      console.error('Error checking registration status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check registration status',
        message: 'Unable to check registration status',
      });
    }
  }

  /**
   * Revoke Strava access and remove tokens
   */
  async revokeStravaAccess(req: Request, res: Response): Promise<void> {
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

      // Remove Strava tokens
      await tokenService.removeStravaTokens(userId);

      // TODO: Update user record to mark Strava as disconnected
      // TODO: Optionally deactivate user account if Strava is required

      res.json({
        success: true,
        message: 'Strava access revoked successfully',
      });
    } catch (error) {
      console.error('Error revoking Strava access:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke access',
        message: 'Unable to revoke Strava access',
      });
    }
  }

  /**
   * Handle Strava API access revocation (webhook or manual trigger)
   */
  async handleStravaAccessRevoked(req: Request, res: Response): Promise<void> {
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

      // Remove Strava tokens
      await tokenService.removeStravaTokens(userId);

      // As per requirement 5.5: Inform user that Strava connection has been revoked
      res.status(403).json({
        success: false,
        error: 'Strava access revoked',
        message: 'Your Strava connection has been revoked, and we can no longer access your data. Please reconnect your Strava account to continue using the app.',
        code: 'STRAVA_ACCESS_REVOKED',
        ui: {
          showWarning: true,
          displayMessage: 'Your Strava connection has been revoked, and we can no longer access your data.',
          actionRequired: 'reconnect_strava',
        },
      });
    } catch (error) {
      console.error('Error handling Strava access revocation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to handle access revocation',
        message: 'Unable to process Strava access revocation',
      });
    }
  }
}

export const authController = new AuthController();