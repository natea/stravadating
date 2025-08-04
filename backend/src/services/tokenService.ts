import { createClient } from 'redis';
import { StravaTokens } from '../types/strava';

export class TokenService {
  private redisClient: any;
  private isConnected = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisConfig: any = {
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      };

      if (process.env.REDIS_PASSWORD) {
        redisConfig.password = process.env.REDIS_PASSWORD;
      }

      this.redisClient = createClient(redisConfig);

      this.redisClient.on('error', (err: Error) => {
        console.error('Redis Client Error:', err);
        this.isConnected = false;
      });

      this.redisClient.on('connect', () => {
        console.log('Redis Client Connected');
        this.isConnected = true;
      });

      await this.redisClient.connect();
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      this.isConnected = false;
    }
  }

  /**
   * Store Strava tokens for a user
   */
  async storeStravaTokens(userId: string, tokens: StravaTokens): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    try {
      const key = `strava_tokens:${userId}`;
      const tokenData = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt.toString(),
        updatedAt: Date.now().toString(),
      };

      await this.redisClient.hSet(key, tokenData);
      
      // Set expiration for the key (7 days from now)
      await this.redisClient.expire(key, 7 * 24 * 60 * 60);
    } catch (error) {
      console.error('Failed to store Strava tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Retrieve Strava tokens for a user
   */
  async getStravaTokens(userId: string): Promise<StravaTokens | null> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    try {
      const key = `strava_tokens:${userId}`;
      const tokenData = await this.redisClient.hGetAll(key);

      if (!tokenData || !tokenData.accessToken) {
        return null;
      }

      return {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: parseInt(tokenData.expiresAt),
      };
    } catch (error) {
      console.error('Failed to retrieve Strava tokens:', error);
      return null;
    }
  }

  /**
   * Check if Strava token needs refresh (expires within 5 minutes)
   */
  async shouldRefreshToken(userId: string): Promise<boolean> {
    const tokens = await this.getStravaTokens(userId);
    if (!tokens) {
      return false;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = tokens.expiresAt - now;
    
    // Refresh if expires within 5 minutes (300 seconds)
    return expiresIn < 300;
  }

  /**
   * Remove Strava tokens for a user
   */
  async removeStravaTokens(userId: string): Promise<void> {
    if (!this.isConnected) {
      return; // Fail silently if Redis is not available
    }

    try {
      const key = `strava_tokens:${userId}`;
      await this.redisClient.del(key);
    } catch (error) {
      console.error('Failed to remove Strava tokens:', error);
    }
  }

  /**
   * Store refresh token in blacklist (for logout)
   */
  async blacklistRefreshToken(token: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = `blacklisted_token:${token}`;
      // Store for 7 days (max refresh token lifetime)
      await this.redisClient.setEx(key, 7 * 24 * 60 * 60, 'blacklisted');
    } catch (error) {
      console.error('Failed to blacklist refresh token:', error);
    }
  }

  /**
   * Check if refresh token is blacklisted
   */
  async isRefreshTokenBlacklisted(token: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const key = `blacklisted_token:${token}`;
      const result = await this.redisClient.get(key);
      return result === 'blacklisted';
    } catch (error) {
      console.error('Failed to check token blacklist:', error);
      return false;
    }
  }

  /**
   * Store user session data
   */
  async storeUserSession(userId: string, sessionData: any): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = `user_session:${userId}`;
      await this.redisClient.setEx(key, 24 * 60 * 60, JSON.stringify(sessionData)); // 24 hours
    } catch (error) {
      console.error('Failed to store user session:', error);
    }
  }

  /**
   * Get user session data
   */
  async getUserSession(userId: string): Promise<any | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const key = `user_session:${userId}`;
      const sessionData = await this.redisClient.get(key);
      return sessionData ? JSON.parse(sessionData) : null;
    } catch (error) {
      console.error('Failed to get user session:', error);
      return null;
    }
  }

  /**
   * Remove user session
   */
  async removeUserSession(userId: string): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      const key = `user_session:${userId}`;
      await this.redisClient.del(key);
    } catch (error) {
      console.error('Failed to remove user session:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.redisClient && this.isConnected) {
      await this.redisClient.disconnect();
      this.isConnected = false;
    }
  }
}

export const tokenService = new TokenService();