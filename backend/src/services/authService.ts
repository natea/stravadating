import axios from 'axios';
import jwt from 'jsonwebtoken';
import { StravaAuthResponse, StravaTokens } from '../types/strava';
import { User } from '../types/user';

export class AuthService {
  private readonly stravaClientId: string;
  private readonly stravaClientSecret: string;
  private readonly stravaRedirectUri: string;
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor() {
    this.stravaClientId = process.env.STRAVA_CLIENT_ID!;
    this.stravaClientSecret = process.env.STRAVA_CLIENT_SECRET!;
    this.stravaRedirectUri = process.env.STRAVA_REDIRECT_URI!;
    this.jwtSecret = process.env.JWT_SECRET!;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET!;

    if (!this.stravaClientId || !this.stravaClientSecret || !this.stravaRedirectUri) {
      throw new Error('Missing required Strava OAuth configuration');
    }
    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('Missing required JWT configuration');
    }
  }

  /**
   * Generate Strava OAuth authorization URL
   */
  generateStravaAuthUrl(state?: string): string {
    const baseUrl = 'https://www.strava.com/oauth/authorize';
    const params = new URLSearchParams({
      client_id: this.stravaClientId,
      redirect_uri: this.stravaRedirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all',
      approval_prompt: 'force',
    });

    if (state) {
      params.append('state', state);
    }

    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string): Promise<StravaAuthResponse> {
    try {
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: this.stravaClientId,
        client_secret: this.stravaClientSecret,
        code,
        grant_type: 'authorization_code',
      });

      return response.data as StravaAuthResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Strava OAuth error: ${error.response?.data?.message || error.message}`);
      }
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }

  /**
   * Refresh Strava access token
   */
  async refreshStravaToken(refreshToken: string): Promise<StravaTokens> {
    try {
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: this.stravaClientId,
        client_secret: this.stravaClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const data = response.data;
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Strava token refresh error: ${error.response?.data?.message || error.message}`);
      }
      throw new Error('Failed to refresh Strava token');
    }
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(user: User): string {
    const payload = {
      userId: user.id,
      stravaId: user.stravaId,
      email: user.email,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      issuer: 'fitness-dating-app',
      audience: 'fitness-dating-users',
    } as jwt.SignOptions);
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(user: User): string {
    const payload = {
      userId: user.id,
      type: 'refresh',
    };

    return jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: 'fitness-dating-app',
      audience: 'fitness-dating-users',
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'fitness-dating-app',
        audience: 'fitness-dating-users',
      });
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verify JWT refresh token
   */
  verifyRefreshToken(token: string): any {
    try {
      const payload = jwt.verify(token, this.jwtRefreshSecret, {
        issuer: 'fitness-dating-app',
        audience: 'fitness-dating-users',
      }) as any;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return payload;
    } catch (error) {
      // Check for our custom error first
      if (error instanceof Error && error.message === 'Invalid token type') {
        throw error;
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw new Error('Refresh token verification failed');
    }
  }

  /**
   * Extract bearer token from authorization header
   */
  extractBearerToken(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}

export const authService = new AuthService();