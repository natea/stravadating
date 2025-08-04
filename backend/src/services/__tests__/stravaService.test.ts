// Mock environment variables before any imports
const originalEnv = process.env;
process.env.STRAVA_CLIENT_ID = 'test_client_id';
process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';

import axios from 'axios';
import { StravaService } from '../stravaService';
import { StravaActivity } from '../../types/strava';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('StravaService', () => {
  let stravaService: StravaService;
  const mockAccessToken = 'mock_access_token';
  const mockRefreshToken = 'mock_refresh_token';

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock axios.create to return a mock instance
    const mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockedAxios.post.mockResolvedValue({ data: {} });

    stravaService = new StravaService();
  });

  describe('constructor', () => {
    it('should throw error if Strava credentials are not configured', () => {
      delete process.env.STRAVA_CLIENT_ID;
      delete process.env.STRAVA_CLIENT_SECRET;

      expect(() => new StravaService()).toThrow('Strava API credentials not configured');

      // Restore for other tests
      process.env.STRAVA_CLIENT_ID = 'test_client_id';
      process.env.STRAVA_CLIENT_SECRET = 'test_client_secret';
    });

    it('should create axios instance with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://www.strava.com/api/v3',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('refreshAccessToken', () => {
    it('should successfully refresh access token', async () => {
      const mockResponse = {
        data: {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_at: 1234567890,
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await stravaService.refreshAccessToken(mockRefreshToken);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://www.strava.com/oauth/token',
        {
          client_id: 'test_client_id',
          client_secret: 'test_client_secret',
          refresh_token: mockRefreshToken,
          grant_type: 'refresh_token',
        }
      );

      expect(result).toEqual({
        accessToken: 'new_access_token',
        refreshToken: 'new_refresh_token',
        expiresAt: 1234567890,
      });
    });

    it('should throw error when token refresh fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(stravaService.refreshAccessToken(mockRefreshToken))
        .rejects.toThrow('Failed to refresh Strava access token');
    });
  });

  describe('fetchAthleteProfile', () => {
    it('should successfully fetch and transform athlete profile', async () => {
      const mockApiResponse = {
        data: {
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
        },
      };

      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get.mockResolvedValueOnce(mockApiResponse);

      const result = await stravaService.fetchAthleteProfile(mockAccessToken);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/athlete', {
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
        },
      });

      expect(result).toEqual({
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
      });
    });

    it('should handle missing optional fields in athlete profile', async () => {
      const mockApiResponse = {
        data: {
          id: 12345,
          firstname: 'John',
          lastname: 'Doe',
        },
      };

      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get.mockResolvedValueOnce(mockApiResponse);

      const result = await stravaService.fetchAthleteProfile(mockAccessToken);

      expect(result).toEqual({
        id: 12345,
        username: '',
        firstname: 'John',
        lastname: 'Doe',
        city: '',
        state: '',
        country: '',
        sex: '',
        profile: '',
        profile_medium: '',
      });
    });

    it('should throw error when fetching athlete profile fails', async () => {
      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('API error'));

      await expect(stravaService.fetchAthleteProfile(mockAccessToken))
        .rejects.toThrow('Failed to fetch athlete profile from Strava');
    });
  });

  describe('fetchAthleteActivities', () => {
    it('should successfully fetch and transform activities', async () => {
      const mockApiResponse = {
        data: [
          {
            id: 1,
            name: 'Morning Run',
            type: 'Run',
            distance: 5000,
            moving_time: 1800,
            average_speed: 2.78,
            start_date: '2024-01-01T08:00:00Z',
            total_elevation_gain: 100,
          },
          {
            id: 2,
            name: 'Evening Bike',
            type: 'Ride',
            distance: 20000,
            moving_time: 3600,
            average_speed: 5.56,
            start_date: '2024-01-02T18:00:00Z',
            total_elevation_gain: 200,
          },
        ],
      };

      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get.mockResolvedValueOnce(mockApiResponse);

      const result = await stravaService.fetchAthleteActivities(mockAccessToken);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/athlete/activities', {
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
        },
        params: {
          page: 1,
          per_page: 200,
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        userId: '',
        name: 'Morning Run',
        type: 'Run',
        distance: 5000,
        movingTime: 1800,
        averageSpeed: 2.78,
        startDate: new Date('2024-01-01T08:00:00Z'),
        elevationGain: 100,
        syncedAt: expect.any(Date),
      });
    });

    it('should handle date parameters correctly', async () => {
      const after = new Date('2024-01-01');
      const before = new Date('2024-01-31');

      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });

      await stravaService.fetchAthleteActivities(
        mockAccessToken,
        after,
        before,
        2,
        50
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/athlete/activities', {
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
        },
        params: {
          page: 2,
          per_page: 50,
          after: Math.floor(after.getTime() / 1000),
          before: Math.floor(before.getTime() / 1000),
        },
      });
    });

    it('should limit per_page to maximum of 200', async () => {
      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get.mockResolvedValueOnce({ data: [] });

      await stravaService.fetchAthleteActivities(
        mockAccessToken,
        undefined,
        undefined,
        1,
        500 // Should be limited to 200
      );

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/athlete/activities', {
        headers: {
          Authorization: `Bearer ${mockAccessToken}`,
        },
        params: {
          page: 1,
          per_page: 200,
        },
      });
    });
  });

  describe('fetchLast90DaysActivities', () => {
    it('should fetch all activities from last 90 days with pagination', async () => {
      const mockActivities1 = Array.from({ length: 200 }, (_, i) => ({
        id: i + 1,
        name: `Activity ${i + 1}`,
        type: 'Run',
        distance: 5000,
        moving_time: 1800,
        average_speed: 2.78,
        start_date: '2024-01-01T08:00:00Z',
        total_elevation_gain: 100,
      }));

      const mockActivities2 = Array.from({ length: 50 }, (_, i) => ({
        id: i + 201,
        name: `Activity ${i + 201}`,
        type: 'Run',
        distance: 5000,
        moving_time: 1800,
        average_speed: 2.78,
        start_date: '2024-01-01T08:00:00Z',
        total_elevation_gain: 100,
      }));

      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockActivities1 })
        .mockResolvedValueOnce({ data: mockActivities2 })
        .mockResolvedValueOnce({ data: [] }); // Empty response to stop pagination

      // Mock delay function
      jest.spyOn(stravaService as any, 'delay').mockResolvedValue(undefined);

      const result = await stravaService.fetchLast90DaysActivities(mockAccessToken);

      expect(result).toHaveLength(250);
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3);
    });
  });

  describe('calculateFitnessMetrics', () => {
    it('should calculate correct fitness metrics from activities', () => {
      const mockActivities: StravaActivity[] = [
        {
          id: 1,
          userId: 'user1',
          name: 'Run 1',
          type: 'Run',
          distance: 5000,
          movingTime: 1800,
          averageSpeed: 2.78, // ~6 min/km pace
          startDate: new Date('2024-01-01'),
          elevationGain: 100,
          syncedAt: new Date(),
        },
        {
          id: 2,
          userId: 'user1',
          name: 'Run 2',
          type: 'Run',
          distance: 10000,
          movingTime: 3600,
          averageSpeed: 2.78,
          startDate: new Date('2024-01-02'),
          elevationGain: 200,
          syncedAt: new Date(),
        },
        {
          id: 3,
          userId: 'user1',
          name: 'Bike Ride',
          type: 'Ride',
          distance: 20000,
          movingTime: 3600,
          averageSpeed: 5.56,
          startDate: new Date('2024-01-03'),
          elevationGain: 300,
          syncedAt: new Date(),
        },
      ];

      const result = stravaService.calculateFitnessMetrics(mockActivities);

      expect(result.weeklyDistance).toBeCloseTo(35000 / 13, 1); // Total distance / 13 weeks
      expect(result.weeklyActivities).toBeCloseTo(3 / 13, 2);
      expect(result.totalDistance).toBe(35000);
      expect(result.longestRun).toBe(10000);
      expect(result.favoriteActivities).toContain('Run');
      expect(result.favoriteActivities).toContain('Ride');
      expect(result.averagePace).toBeGreaterThan(0);
    });

    it('should handle empty activities array', () => {
      const result = stravaService.calculateFitnessMetrics([]);

      expect(result).toEqual({
        weeklyDistance: 0,
        weeklyActivities: 0,
        averagePace: 0,
        favoriteActivities: [],
        totalDistance: 0,
        longestRun: 0,
        lastSyncDate: expect.any(Date),
      });
    });

    it('should calculate average pace correctly for running activities', () => {
      const mockActivities: StravaActivity[] = [
        {
          id: 1,
          userId: 'user1',
          name: 'Fast Run',
          type: 'Run',
          distance: 5000,
          movingTime: 1500,
          averageSpeed: 3.33, // 3 m/s = 5 min/km pace
          startDate: new Date(),
          elevationGain: 0,
          syncedAt: new Date(),
        },
        {
          id: 2,
          userId: 'user1',
          name: 'Slow Run',
          type: 'Run',
          distance: 5000,
          movingTime: 2100,
          averageSpeed: 2.38, // 2.38 m/s = 7 min/km pace
          startDate: new Date(),
          elevationGain: 0,
          syncedAt: new Date(),
        },
      ];

      const result = stravaService.calculateFitnessMetrics(mockActivities);

      // Average pace should be around 6 min/km (360 seconds)
      expect(result.averagePace).toBeCloseTo(360, 0);
    });
  });

  describe('rate limiting', () => {
    it('should return current rate limit status', () => {
      const status = stravaService.getRateLimitStatus();

      expect(status).toHaveProperty('shortTermUsage');
      expect(status).toHaveProperty('shortTermLimit');
      expect(status).toHaveProperty('dailyUsage');
      expect(status).toHaveProperty('dailyLimit');
    });

    it('should check if requests can be made', () => {
      const canMake = stravaService.canMakeRequest();
      expect(typeof canMake).toBe('boolean');
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network error'));

      await expect(stravaService.fetchAthleteProfile(mockAccessToken))
        .rejects.toThrow('Failed to fetch athlete profile from Strava');
    });

    it('should handle API errors gracefully', async () => {
      const mockAxiosInstance = mockedAxios.create() as jest.Mocked<any>;
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      });

      await expect(stravaService.fetchAthleteActivities(mockAccessToken))
        .rejects.toThrow('Failed to fetch activities from Strava');
    });
  });
});