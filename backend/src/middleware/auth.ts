import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        stravaId: number;
        email: string;
      };
    }
  }
}

/**
 * Middleware to authenticate requests using JWT tokens
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractBearerToken(authHeader);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Please provide a valid access token in the Authorization header',
      });
      return;
    }

    const payload = authService.verifyAccessToken(token);
    req.user = {
      userId: payload.userId,
      stravaId: payload.stravaId,
      email: payload.email,
    };

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token verification failed';
    
    res.status(401).json({
      success: false,
      error: 'Invalid token',
      message,
    });
  }
};

/**
 * Middleware to optionally authenticate requests (doesn't fail if no token)
 */
export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = authService.extractBearerToken(authHeader);

    if (token) {
      const payload = authService.verifyAccessToken(token);
      req.user = {
        userId: payload.userId,
        stravaId: payload.stravaId,
        email: payload.email,
      };
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens, just proceed without user
    next();
  }
};

/**
 * Middleware to check if user has Strava authentication
 */
export const requireStravaAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user?.stravaId) {
    res.status(403).json({
      success: false,
      error: 'Strava authentication required',
      message: 'This endpoint requires Strava account connection',
    });
    return;
  }

  next();
};

/**
 * Middleware to ensure Strava tokens are fresh (auto-refresh if needed)
 */
export const ensureFreshStravaTokens = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'User must be authenticated to access this endpoint',
      });
      return;
    }

    const { tokenService } = await import('../services/tokenService');
    const { authService } = await import('../services/authService');

    // Check if tokens need refresh
    const shouldRefresh = await tokenService.shouldRefreshToken(userId);
    
    if (shouldRefresh) {
      const currentTokens = await tokenService.getStravaTokens(userId);
      
      if (currentTokens?.refreshToken) {
        try {
          // Refresh the tokens
          const newTokens = await authService.refreshStravaToken(currentTokens.refreshToken);
          
          // Store the new tokens
          await tokenService.storeStravaTokens(userId, newTokens);
          
          console.log(`Automatically refreshed Strava tokens for user ${userId}`);
        } catch (error) {
          console.error('Failed to refresh Strava tokens:', error);
          
          // If refresh fails, the user needs to re-authenticate
          res.status(401).json({
            success: false,
            error: 'Strava authentication expired',
            message: 'Please reconnect your Strava account',
            code: 'STRAVA_REAUTH_REQUIRED',
          });
          return;
        }
      }
    }

    next();
  } catch (error) {
    console.error('Error in ensureFreshStravaTokens middleware:', error);
    next(); // Continue anyway, let the actual API call handle token issues
  }
};