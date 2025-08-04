import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { StravaActivity, StravaAthlete, StravaTokens } from '../types/strava';
import { FitnessStats } from '../types/fitness';
import { logger } from '../utils/logger';

interface StravaApiActivity {
  id: number;
  name: string;
  type: string;
  distance: number;
  moving_time: number;
  average_speed: number;
  start_date: string;
  total_elevation_gain: number;
}

interface StravaApiAthlete {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  city: string;
  state: string;
  country: string;
  sex: string;
  profile: string;
  profile_medium: string;
}

interface StravaTokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface RateLimitInfo {
  shortTermUsage: number;
  shortTermLimit: number;
  dailyUsage: number;
  dailyLimit: number;
}

export class StravaService {
  private apiClient: AxiosInstance;
  private readonly baseUrl = 'https://www.strava.com/api/v3';
  private readonly clientId: string;
  private readonly clientSecret: string;
  private rateLimitInfo: RateLimitInfo = {
    shortTermUsage: 0,
    shortTermLimit: 600,
    dailyUsage: 0,
    dailyLimit: 30000,
  };

  constructor() {
    this.clientId = process.env.STRAVA_CLIENT_ID!;
    this.clientSecret = process.env.STRAVA_CLIENT_SECRET!;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Strava API credentials not configured');
    }

    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for rate limiting and error handling
   */
  private setupInterceptors(): void {
    // Request interceptor for rate limiting
    this.apiClient.interceptors.request.use(
      async (config) => {
        await this.checkRateLimit();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for rate limit tracking and error handling
    this.apiClient.interceptors.response.use(
      (response: AxiosResponse) => {
        this.updateRateLimitInfo(response);
        return response;
      },
      async (error: AxiosError) => {
        if (error.response) {
          this.updateRateLimitInfo(error.response);
          
          // Handle rate limiting
          if (error.response.status === 429) {
            const retryAfter = this.getRetryDelay(error.response);
            logger.warn(`Rate limit exceeded, retrying after ${retryAfter}ms`);
            await this.delay(retryAfter);
            return this.apiClient.request(error.config!);
          }

          // Handle token expiration
          if (error.response.status === 401) {
            throw new Error('Strava access token expired or invalid');
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(response: AxiosResponse): void {
    const headers = response.headers;
    
    if (headers['x-ratelimit-usage']) {
      const usage = headers['x-ratelimit-usage'].split(',');
      this.rateLimitInfo.shortTermUsage = parseInt(usage[0]);
      this.rateLimitInfo.dailyUsage = parseInt(usage[1]);
    }

    if (headers['x-ratelimit-limit']) {
      const limits = headers['x-ratelimit-limit'].split(',');
      this.rateLimitInfo.shortTermLimit = parseInt(limits[0]);
      this.rateLimitInfo.dailyLimit = parseInt(limits[1]);
    }
  }

  /**
   * Check if we're approaching rate limits and delay if necessary
   */
  private async checkRateLimit(): Promise<void> {
    const shortTermThreshold = this.rateLimitInfo.shortTermLimit * 0.8;
    const dailyThreshold = this.rateLimitInfo.dailyLimit * 0.9;

    if (this.rateLimitInfo.shortTermUsage >= shortTermThreshold) {
      const delay = 15 * 60 * 1000; // 15 minutes
      logger.warn(`Approaching short-term rate limit, delaying ${delay}ms`);
      await this.delay(delay);
    }

    if (this.rateLimitInfo.dailyUsage >= dailyThreshold) {
      const delay = 60 * 60 * 1000; // 1 hour
      logger.warn(`Approaching daily rate limit, delaying ${delay}ms`);
      await this.delay(delay);
    }
  }

  /**
   * Get retry delay from rate limit response
   */
  private getRetryDelay(response: AxiosResponse): number {
    const retryAfter = response.headers['retry-after'];
    if (retryAfter) {
      return parseInt(retryAfter) * 1000;
    }

    // Exponential backoff with jitter
    const baseDelay = 15 * 60 * 1000; // 15 minutes
    const jitter = Math.random() * 5 * 60 * 1000; // 0-5 minutes
    return baseDelay + jitter;
  }

  /**
   * Delay execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Refresh Strava access token
   */
  async refreshAccessToken(refreshToken: string): Promise<StravaTokens> {
    try {
      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      const data: StravaTokenRefreshResponse = response.data;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      };
    } catch (error) {
      logger.error('Failed to refresh Strava token:', error);
      throw new Error('Failed to refresh Strava access token');
    }
  }

  /**
   * Fetch athlete profile from Strava
   */
  async fetchAthleteProfile(accessToken: string): Promise<StravaAthlete> {
    try {
      const response = await this.apiClient.get<StravaApiAthlete>('/athlete', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return this.transformAthleteData(response.data);
    } catch (error) {
      logger.error('Failed to fetch athlete profile:', error);
      throw new Error('Failed to fetch athlete profile from Strava');
    }
  }

  /**
   * Fetch athlete activities from Strava
   */
  async fetchAthleteActivities(
    accessToken: string,
    after?: Date,
    before?: Date,
    page: number = 1,
    perPage: number = 200
  ): Promise<StravaActivity[]> {
    try {
      const params: any = {
        page,
        per_page: Math.min(perPage, 200), // Strava max is 200
      };

      if (after) {
        params.after = Math.floor(after.getTime() / 1000);
      }

      if (before) {
        params.before = Math.floor(before.getTime() / 1000);
      }

      const response = await this.apiClient.get<StravaApiActivity[]>('/athlete/activities', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params,
      });

      return response.data.map(activity => this.transformActivityData(activity));
    } catch (error) {
      logger.error('Failed to fetch athlete activities:', error);
      throw new Error('Failed to fetch activities from Strava');
    }
  }

  /**
   * Fetch all activities for the last 90 days
   */
  async fetchLast90DaysActivities(accessToken: string): Promise<StravaActivity[]> {
    const after = new Date();
    after.setDate(after.getDate() - 90);

    const allActivities: StravaActivity[] = [];
    let page = 1;
    let hasMoreData = true;

    while (hasMoreData) {
      try {
        const activities = await this.fetchAthleteActivities(
          accessToken,
          after,
          undefined,
          page,
          200
        );

        if (activities.length === 0) {
          hasMoreData = false;
        } else {
          allActivities.push(...activities);
          page++;
          
          // Add delay between requests to respect rate limits
          await this.delay(1000);
        }
      } catch (error) {
        logger.error(`Failed to fetch activities page ${page}:`, error);
        throw error;
      }
    }

    return allActivities;
  }

  /**
   * Transform Strava API athlete data to internal format
   */
  private transformAthleteData(apiData: StravaApiAthlete): StravaAthlete {
    return {
      id: apiData.id,
      username: apiData.username || '',
      firstname: apiData.firstname || '',
      lastname: apiData.lastname || '',
      city: apiData.city || '',
      state: apiData.state || '',
      country: apiData.country || '',
      sex: apiData.sex || '',
      profile: apiData.profile || '',
      profile_medium: apiData.profile_medium || '',
    };
  }

  /**
   * Transform Strava API activity data to internal format
   */
  private transformActivityData(apiData: StravaApiActivity): StravaActivity {
    return {
      id: apiData.id,
      userId: '', // Will be set by the calling service
      name: apiData.name,
      type: apiData.type,
      distance: apiData.distance,
      movingTime: apiData.moving_time,
      averageSpeed: apiData.average_speed,
      startDate: new Date(apiData.start_date),
      elevationGain: apiData.total_elevation_gain || 0,
      syncedAt: new Date(),
    };
  }

  /**
   * Calculate fitness metrics from activities
   */
  calculateFitnessMetrics(activities: StravaActivity[]): Omit<FitnessStats, 'id' | 'userId'> {
    if (activities.length === 0) {
      return {
        weeklyDistance: 0,
        weeklyActivities: 0,
        averagePace: 0,
        favoriteActivities: [],
        totalDistance: 0,
        longestRun: 0,
        lastSyncDate: new Date(),
      };
    }

    // Calculate weekly averages (last 90 days / ~13 weeks)
    const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
    const weeklyDistance = totalDistance / 13; // Approximate weeks in 90 days
    const weeklyActivities = activities.length / 13;

    // Calculate average pace (for running activities)
    const runningActivities = activities.filter(a => 
      a.type.toLowerCase().includes('run') && a.averageSpeed > 0
    );
    
    let averagePace = 0;
    if (runningActivities.length > 0) {
      const totalPace = runningActivities.reduce((sum, activity) => {
        // Convert speed (m/s) to pace (seconds per km)
        return sum + (1000 / activity.averageSpeed);
      }, 0);
      averagePace = totalPace / runningActivities.length;
    }

    // Find favorite activities (most frequent types)
    const activityTypeCount = new Map<string, number>();
    activities.forEach(activity => {
      const count = activityTypeCount.get(activity.type) || 0;
      activityTypeCount.set(activity.type, count + 1);
    });

    const favoriteActivities = Array.from(activityTypeCount.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type]) => type);

    // Find longest run
    const longestRun = Math.max(
      ...activities
        .filter(a => a.type.toLowerCase().includes('run'))
        .map(a => a.distance),
      0
    );

    return {
      weeklyDistance,
      weeklyActivities,
      averagePace,
      favoriteActivities,
      totalDistance,
      longestRun,
      lastSyncDate: new Date(),
    };
  }

  /**
   * Get recent activities (helper method)
   */
  getRecentActivities(activities: StravaActivity[], limit: number = 10): StravaActivity[] {
    return activities
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .slice(0, limit);
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  /**
   * Check if we can make API requests without hitting rate limits
   */
  canMakeRequest(): boolean {
    const shortTermThreshold = this.rateLimitInfo.shortTermLimit * 0.9;
    const dailyThreshold = this.rateLimitInfo.dailyLimit * 0.95;

    return (
      this.rateLimitInfo.shortTermUsage < shortTermThreshold &&
      this.rateLimitInfo.dailyUsage < dailyThreshold
    );
  }
}

// Export a factory function instead of instantiating at module level
export const createStravaService = () => new StravaService();

// For backward compatibility, export a default instance if credentials are available
let stravaService: StravaService | null = null;

try {
  if (process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET) {
    stravaService = new StravaService();
  }
} catch (error) {
  // Service will be null if credentials are not configured
}

export { stravaService };