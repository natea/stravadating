// Mock environment variables before any imports
process.env.STRAVA_CLIENT_ID = 'test_client_id';
process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';

import { StravaIntegrationService } from '../stravaIntegrationService';
import { StravaActivity, StravaAthlete, StravaTokens } from '../../types/strava';

// Mock the StravaService module
jest.mock('../stravaService', () => ({
  createStravaService: jest.fn(),
  StravaService: jest.fn(),
}));

import { createStravaService, StravaService } from '../stravaService';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';
const mockCreateStravaService = createStravaService as jest.MockedFunction<typeof createStravaService>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('StravaIntegrationService', () => {
  let integrationService: StravaIntegrationService;
  let mockStravaService: jest.Mocked<StravaService>;

  const mockUserId = 'user123';
  const mockTokens: StravaTokens = {
    accessToken: 'access_token_123',
    refreshToken: 'refresh_token_123',
    expiresAt: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  };

  const mockAthlete: StravaAthlete = {
    id: 12345,
    username: 'testuser',
    firstname: 'John',
    lastname: 'Doe',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    sex: 'M',
    profile: 'https://example.com/profile.jpg',
    profile_medium: 'https://example.com/profile_medium.jpg',
  };

  const mockActivities: StravaActivity[] = [
    {
      id: 1,
      userId: mockUserId,
      name: 'Morning Run',
      type: 'Run',
      distance: 5000,
      movingTime: 1800,
      averageSpeed: 2.78,
      startDate: new Date('2024-01-01T08:00:00Z'),
      elevationGain: 100,
      syncedAt: new Date(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock instance
    mockStravaService = {
      refreshAccessToken: jest.fn(),
      fetchAthleteProfile: jest.fn(),
      fetchAthleteActivities: jest.fn(),
      fetchLast90DaysActivities: jest.fn(),
      calculateFitnessMetrics: jest.fn(),
      getRecentActivities: jest.fn(),
      getRateLimitStatus: jest.fn(),
      canMakeRequest: jest.fn(),
    } as any;

    // Mock the createStravaService function
    mockCreateStravaService.mockReturnValue(mockStravaService);

    integrationService = new StravaIntegrationService();
  });

  describe('token management', () => {
    it('should store and retrieve user tokens', () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      const retrievedTokens = integrationService.getUserTokens(mockUserId);

      expect(retrievedTokens).toEqual({
        userId: mockUserId,
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        expiresAt: mockTokens.expiresAt,
      });
    });

    it('should return null for non-existent user tokens', () => {
      const tokens = integrationService.getUserTokens('nonexistent');
      expect(tokens).toBeNull();
    });

    it('should remove user tokens', () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      integrationService.removeUserTokens(mockUserId);
      
      const tokens = integrationService.getUserTokens(mockUserId);
      expect(tokens).toBeNull();
    });
  });

  describe('fetchAthleteProfile', () => {
    it('should fetch athlete profile with valid token', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteProfile.mockResolvedValueOnce(mockAthlete);

      const result = await integrationService.fetchAthleteProfile(mockUserId);

      expect(result).toEqual(mockAthlete);
      expect(mockStravaService.fetchAthleteProfile).toHaveBeenCalledWith(mockTokens.accessToken);
    });

    it('should refresh token if expired and retry', async () => {
      const expiredTokens: StravaTokens = {
        ...mockTokens,
        expiresAt: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };
      
      const newTokens: StravaTokens = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      integrationService.setUserTokens(mockUserId, expiredTokens);
      mockStravaService.refreshAccessToken.mockResolvedValueOnce(newTokens);
      mockStravaService.fetchAthleteProfile.mockResolvedValueOnce(mockAthlete);

      const result = await integrationService.fetchAthleteProfile(mockUserId);

      expect(result).toEqual(mockAthlete);
      expect(mockStravaService.refreshAccessToken).toHaveBeenCalledWith(expiredTokens.refreshToken);
      expect(mockStravaService.fetchAthleteProfile).toHaveBeenCalledWith(newTokens.accessToken);
    });

    it('should handle 401 error by refreshing token and retrying', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      
      const newTokens: StravaTokens = {
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      mockStravaService.fetchAthleteProfile
        .mockRejectedValueOnce(new Error('Strava access token expired or invalid'))
        .mockResolvedValueOnce(mockAthlete);
      
      mockStravaService.refreshAccessToken.mockResolvedValueOnce(newTokens);

      const result = await integrationService.fetchAthleteProfile(mockUserId);

      expect(result).toEqual(mockAthlete);
      expect(mockStravaService.refreshAccessToken).toHaveBeenCalledWith(mockTokens.refreshToken);
      expect(mockStravaService.fetchAthleteProfile).toHaveBeenCalledTimes(2);
    });

    it('should throw error if user tokens not found', async () => {
      await expect(integrationService.fetchAthleteProfile('nonexistent'))
        .rejects.toThrow('User tokens not found');
    });

    it('should throw error if token refresh fails', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      
      mockStravaService.fetchAthleteProfile
        .mockRejectedValueOnce(new Error('Strava access token expired or invalid'));
      
      mockStravaService.refreshAccessToken
        .mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(integrationService.fetchAthleteProfile(mockUserId))
        .rejects.toThrow('Strava access token is invalid and cannot be refreshed');
    });
  });

  describe('fetchAthleteActivities', () => {
    it('should fetch activities with token management', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteActivities.mockResolvedValueOnce(mockActivities);

      const result = await integrationService.fetchAthleteActivities(mockUserId);

      expect(result).toEqual(mockActivities);
      expect(mockStravaService.fetchAthleteActivities).toHaveBeenCalledWith(
        mockTokens.accessToken,
        undefined,
        undefined,
        1,
        200
      );
    });

    it('should pass date parameters correctly', async () => {
      const after = new Date('2024-01-01');
      const before = new Date('2024-01-31');

      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteActivities.mockResolvedValueOnce(mockActivities);

      await integrationService.fetchAthleteActivities(mockUserId, after, before, 2, 50);

      expect(mockStravaService.fetchAthleteActivities).toHaveBeenCalledWith(
        mockTokens.accessToken,
        after,
        before,
        2,
        50
      );
    });
  });

  describe('fetchLast90DaysActivities', () => {
    it('should fetch 90 days activities with token management', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchLast90DaysActivities.mockResolvedValueOnce(mockActivities);

      const result = await integrationService.fetchLast90DaysActivities(mockUserId);

      expect(result).toEqual(mockActivities);
      expect(mockStravaService.fetchLast90DaysActivities).toHaveBeenCalledWith(mockTokens.accessToken);
    });
  });

  describe('syncUserFitnessData', () => {
    it('should sync user fitness data successfully', async () => {
      const mockFitnessMetrics = {
        weeklyDistance: 25000,
        weeklyActivities: 3,
        averagePace: 360,
        favoriteActivities: ['Run'],
        totalDistance: 100000,
        longestRun: 15000,
        lastSyncDate: new Date(),
      };

      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteProfile.mockResolvedValueOnce(mockAthlete);
      mockStravaService.fetchLast90DaysActivities.mockResolvedValueOnce(mockActivities);
      mockStravaService.calculateFitnessMetrics.mockReturnValueOnce(mockFitnessMetrics);

      const result = await integrationService.syncUserFitnessData(mockUserId);

      expect(result).toEqual({
        activities: mockActivities.map(a => ({ ...a, userId: mockUserId })),
        fitnessMetrics: mockFitnessMetrics,
        profile: mockAthlete,
      });

      expect(mockStravaService.fetchAthleteProfile).toHaveBeenCalledWith(mockTokens.accessToken);
      expect(mockStravaService.fetchLast90DaysActivities).toHaveBeenCalledWith(mockTokens.accessToken);
      expect(mockStravaService.calculateFitnessMetrics).toHaveBeenCalledWith(
        mockActivities.map(a => ({ ...a, userId: mockUserId }))
      );
    });

    it('should handle sync errors', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteProfile.mockRejectedValueOnce(new Error('API Error'));

      await expect(integrationService.syncUserFitnessData(mockUserId))
        .rejects.toThrow('API Error');
    });
  });

  describe('fetchIncrementalActivities', () => {
    it('should fetch activities since last sync date', async () => {
      const lastSyncDate = new Date('2024-01-01');
      
      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteActivities.mockResolvedValueOnce(mockActivities);

      const result = await integrationService.fetchIncrementalActivities(mockUserId, lastSyncDate);

      expect(result).toEqual(mockActivities.map(a => ({ ...a, userId: mockUserId })));
      expect(mockStravaService.fetchAthleteActivities).toHaveBeenCalledWith(
        mockTokens.accessToken,
        lastSyncDate,
        undefined,
        1,
        200
      );
    });
  });

  describe('validateStravaConnection', () => {
    it('should return true for valid connection', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteProfile.mockResolvedValueOnce(mockAthlete);

      const result = await integrationService.validateStravaConnection(mockUserId);

      expect(result).toBe(true);
    });

    it('should return false for invalid connection that cannot be refreshed', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteProfile
        .mockRejectedValueOnce(new Error('Strava access token is invalid and cannot be refreshed'));

      const result = await integrationService.validateStravaConnection(mockUserId);

      expect(result).toBe(false);
    });

    it('should throw error for other types of errors', async () => {
      integrationService.setUserTokens(mockUserId, mockTokens);
      mockStravaService.fetchAthleteProfile
        .mockRejectedValueOnce(new Error('Network error'));

      await expect(integrationService.validateStravaConnection(mockUserId))
        .rejects.toThrow('Network error');
    });
  });

  describe('rate limiting', () => {
    it('should return rate limit status', () => {
      const mockStatus = {
        shortTermUsage: 10,
        shortTermLimit: 600,
        dailyUsage: 100,
        dailyLimit: 30000,
      };

      mockStravaService.getRateLimitStatus.mockReturnValueOnce(mockStatus);

      const result = integrationService.getRateLimitStatus();

      expect(result).toEqual(mockStatus);
    });

    it('should check if requests can be made', () => {
      mockStravaService.canMakeRequest.mockReturnValueOnce(true);

      const result = integrationService.canMakeRequest();

      expect(result).toBe(true);
    });
  });

  describe('getRecentActivities', () => {
    it('should get recent activities', () => {
      const recentActivities = [mockActivities[0]];
      mockStravaService.getRecentActivities.mockReturnValueOnce(recentActivities);

      const result = integrationService.getRecentActivities(mockActivities, 5);

      expect(result).toEqual(recentActivities);
      expect(mockStravaService.getRecentActivities).toHaveBeenCalledWith(mockActivities, 5);
    });
  });
});