import { StravaService, createStravaService } from './stravaService';
import { StravaActivity, StravaAthlete, StravaTokens } from '../types/strava';
import { FitnessStats } from '../types/fitness';
import { logger } from '../utils/logger';

interface UserStravaTokens {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class StravaIntegrationService {
  private stravaService: StravaService;
  private tokenStorage: Map<string, UserStravaTokens> = new Map();

  constructor() {
    this.stravaService = createStravaService();
  }

  /**
   * Store user's Strava tokens
   */
  setUserTokens(userId: string, tokens: StravaTokens): void {
    this.tokenStorage.set(userId, {
      userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });
  }

  /**
   * Get user's Strava tokens
   */
  getUserTokens(userId: string): UserStravaTokens | null {
    return this.tokenStorage.get(userId) || null;
  }

  /**
   * Check if token is expired or will expire soon (within 5 minutes)
   */
  private isTokenExpired(expiresAt: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    const fiveMinutesFromNow = now + (5 * 60);
    return expiresAt <= fiveMinutesFromNow;
  }

  /**
   * Refresh user's access token if needed
   */
  private async refreshTokenIfNeeded(userId: string): Promise<string> {
    const userTokens = this.getUserTokens(userId);
    if (!userTokens) {
      throw new Error('User tokens not found');
    }

    if (this.isTokenExpired(userTokens.expiresAt)) {
      logger.info(`Refreshing expired token for user ${userId}`);
      
      try {
        const newTokens = await this.stravaService.refreshAccessToken(userTokens.refreshToken);
        
        // Update stored tokens
        this.setUserTokens(userId, newTokens);
        
        logger.info(`Successfully refreshed token for user ${userId}`);
        return newTokens.accessToken;
      } catch (error) {
        logger.error(`Failed to refresh token for user ${userId}:`, error);
        throw new Error('Failed to refresh Strava access token');
      }
    }

    return userTokens.accessToken;
  }

  /**
   * Execute Strava API call with automatic token refresh on 401 errors
   */
  private async executeWithTokenRefresh<T>(
    userId: string,
    apiCall: (accessToken: string) => Promise<T>
  ): Promise<T> {
    let accessToken = await this.refreshTokenIfNeeded(userId);

    try {
      return await apiCall(accessToken);
    } catch (error: any) {
      // If we get a 401 error, try refreshing the token once more
      if (error.message?.includes('expired') || error.message?.includes('invalid')) {
        logger.warn(`Token appears invalid for user ${userId}, attempting refresh`);
        
        try {
          const userTokens = this.getUserTokens(userId);
          if (!userTokens) {
            throw new Error('User tokens not found');
          }

          const newTokens = await this.stravaService.refreshAccessToken(userTokens.refreshToken);
          this.setUserTokens(userId, newTokens);
          
          // Retry the API call with the new token
          return await apiCall(newTokens.accessToken);
        } catch (refreshError) {
          logger.error(`Failed to refresh token after 401 for user ${userId}:`, refreshError);
          throw new Error('Strava access token is invalid and cannot be refreshed');
        }
      }

      throw error;
    }
  }

  /**
   * Fetch athlete profile with automatic token management
   */
  async fetchAthleteProfile(userId: string): Promise<StravaAthlete> {
    return this.executeWithTokenRefresh(userId, (accessToken) =>
      this.stravaService.fetchAthleteProfile(accessToken)
    );
  }

  /**
   * Fetch athlete activities with automatic token management
   */
  async fetchAthleteActivities(
    userId: string,
    after?: Date,
    before?: Date,
    page: number = 1,
    perPage: number = 200
  ): Promise<StravaActivity[]> {
    return this.executeWithTokenRefresh(userId, (accessToken) =>
      this.stravaService.fetchAthleteActivities(accessToken, after, before, page, perPage)
    );
  }

  /**
   * Fetch last 90 days of activities with automatic token management
   */
  async fetchLast90DaysActivities(userId: string): Promise<StravaActivity[]> {
    return this.executeWithTokenRefresh(userId, (accessToken) =>
      this.stravaService.fetchLast90DaysActivities(accessToken)
    );
  }

  /**
   * Sync user's Strava data and calculate fitness metrics
   */
  async syncUserFitnessData(userId: string): Promise<{
    activities: StravaActivity[];
    fitnessMetrics: Omit<FitnessStats, 'id' | 'userId'>;
    profile: StravaAthlete;
  }> {
    try {
      logger.info(`Starting fitness data sync for user ${userId}`);

      // Fetch profile and activities in parallel
      const [profile, activities] = await Promise.all([
        this.fetchAthleteProfile(userId),
        this.fetchLast90DaysActivities(userId),
      ]);

      // Set userId on activities
      const activitiesWithUserId = activities.map(activity => ({
        ...activity,
        userId,
      }));

      // Calculate fitness metrics
      const fitnessMetrics = this.stravaService.calculateFitnessMetrics(activitiesWithUserId);

      logger.info(`Successfully synced ${activities.length} activities for user ${userId}`);

      return {
        activities: activitiesWithUserId,
        fitnessMetrics,
        profile,
      };
    } catch (error) {
      logger.error(`Failed to sync fitness data for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get incremental activities since last sync
   */
  async fetchIncrementalActivities(
    userId: string,
    lastSyncDate: Date
  ): Promise<StravaActivity[]> {
    const activities = await this.fetchAthleteActivities(
      userId,
      lastSyncDate,
      undefined,
      1,
      200
    );

    return activities.map(activity => ({
      ...activity,
      userId,
    }));
  }

  /**
   * Check if user's Strava connection is still valid
   */
  async validateStravaConnection(userId: string): Promise<boolean> {
    try {
      await this.fetchAthleteProfile(userId);
      return true;
    } catch (error: any) {
      if (error.message?.includes('cannot be refreshed')) {
        logger.warn(`Strava connection invalid for user ${userId}`);
        return false;
      }
      
      // Other errors might be temporary
      logger.error(`Error validating Strava connection for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Remove user's tokens (e.g., when they disconnect Strava)
   */
  removeUserTokens(userId: string): void {
    this.tokenStorage.delete(userId);
    logger.info(`Removed Strava tokens for user ${userId}`);
  }

  /**
   * Get rate limit status from Strava service
   */
  getRateLimitStatus() {
    return this.stravaService.getRateLimitStatus();
  }

  /**
   * Check if we can make API requests
   */
  canMakeRequest(): boolean {
    return this.stravaService.canMakeRequest();
  }

  /**
   * Get recent activities for a user (helper method)
   */
  getRecentActivities(activities: StravaActivity[], limit: number = 10): StravaActivity[] {
    return this.stravaService.getRecentActivities(activities, limit);
  }
}

export const stravaIntegrationService = new StravaIntegrationService();