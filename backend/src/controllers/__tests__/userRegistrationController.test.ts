import { UserModel } from '../../models/User';
import { FitnessStatsModel } from '../../models/FitnessStats';
import { StravaActivityModel } from '../../models/StravaActivity';
import { FitnessThresholdModel } from '../../models/FitnessThreshold';
import { UserRegistrationService } from '../../services/userRegistrationService';
import { tokenService } from '../../services/tokenService';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/FitnessStats');
jest.mock('../../models/StravaActivity');
jest.mock('../../models/FitnessThreshold');
jest.mock('../../services/tokenService');
jest.mock('../../services/stravaIntegrationService');
jest.mock('../../services/fitnessEvaluationService');

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockFitnessStatsModel = FitnessStatsModel as jest.Mocked<typeof FitnessStatsModel>;
const mockStravaActivityModel = StravaActivityModel as jest.Mocked<typeof StravaActivityModel>;
const mockFitnessThresholdModel = FitnessThresholdModel as jest.Mocked<typeof FitnessThresholdModel>;
const mockTokenService = tokenService as jest.Mocked<typeof tokenService>;

describe('User Registration Integration Tests', () => {
  beforeAll(() => {
    // Mock Express app setup would go here
    // For now, we'll test the service directly
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UserRegistrationService.registerUser', () => {
    const mockStravaResponse = {
      access_token: 'mock_access_token',
      refresh_token: 'mock_refresh_token',
      athlete: {
        id: 12345,
        username: 'johndoe',
        firstname: 'John',
        lastname: 'Doe',
        city: 'San Francisco',
        state: 'CA',
        country: 'US',
        sex: 'M',
        profile: 'https://example.com/profile.jpg',
        profile_medium: 'https://example.com/photo.jpg',
      },
    };

    const mockActivities = [
      {
        id: 1,
        name: 'Morning Run',
        type: 'Run',
        distance: 5000,
        movingTime: 1800,
        averageSpeed: 2.78,
        startDate: new Date('2024-01-01'),
        elevationGain: 100,
        userId: 'temp_12345',
      },
      {
        id: 2,
        name: 'Evening Run',
        type: 'Run',
        distance: 8000,
        movingTime: 2400,
        averageSpeed: 3.33,
        startDate: new Date('2024-01-03'),
        elevationGain: 150,
        userId: 'temp_12345',
      },
    ];

    const mockFitnessThreshold = {
      id: 'threshold_1',
      weeklyDistance: 10000,
      weeklyActivities: 3,
      averagePace: 360,
      allowedActivityTypes: ['Run', 'Ride'],
      updatedAt: new Date(),
      updatedBy: 'admin',
    };

    it('should successfully register a new user who meets fitness threshold', async () => {
      // Setup mocks
      mockUserModel.findByStravaId.mockResolvedValue(null);
      mockFitnessThresholdModel.getCurrent.mockResolvedValue(mockFitnessThreshold);
      
      const mockUser = {
        id: 'user_123',
        email: 'john.doe@example.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: '',
        photos: ['https://example.com/photo.jpg'],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockUserModel.create.mockResolvedValue(mockUser);
      mockFitnessStatsModel.create.mockResolvedValue({
        id: 'stats_123',
        userId: 'user_123',
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: 300,
        favoriteActivities: ['Run'],
        totalDistance: 13000,
        longestRun: 8000,
        lastSyncDate: new Date(),
      });
      mockStravaActivityModel.createMany.mockResolvedValue(2);
      mockTokenService.storeStravaTokens.mockResolvedValue();

      // Mock FitnessEvaluationService
      const mockFitnessEvaluationService = require('../../services/fitnessEvaluationService').FitnessEvaluationService;
      mockFitnessEvaluationService.calculateFitnessMetrics.mockReturnValue({
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: 300,
        activityTypes: ['Run'],
      });

      // Mock Strava integration service
      const mockStravaIntegrationService = require('../../services/stravaIntegrationService').stravaIntegrationService;
      mockStravaIntegrationService.syncUserFitnessData.mockResolvedValue({
        activities: mockActivities,
        fitnessMetrics: {
          weeklyDistance: 15000,
          weeklyActivities: 4,
          averagePace: 300,
          favoriteActivities: ['Run'],
          totalDistance: 13000,
          longestRun: 8000,
        },
        profile: mockStravaResponse.athlete,
      });

      // Execute registration
      const result = await UserRegistrationService.registerUser({
        stravaAuthResponse: mockStravaResponse,
        additionalInfo: { age: 30 },
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe('user_123');
      expect(result.message).toContain('Registration successful');
      
      // Verify database calls
      expect(mockUserModel.findByStravaId).toHaveBeenCalledWith(12345);
      expect(mockUserModel.create).toHaveBeenCalled();
      expect(mockFitnessStatsModel.create).toHaveBeenCalled();
      expect(mockStravaActivityModel.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'user_123' }),
        ])
      );
    });

    it('should reject registration if user does not meet fitness threshold', async () => {
      // Setup mocks for user who doesn't meet threshold
      mockUserModel.findByStravaId.mockResolvedValue(null);
      mockFitnessThresholdModel.getCurrent.mockResolvedValue(mockFitnessThreshold);

      const lowActivityUser = [
        {
          id: 1,
          name: 'Short Walk',
          type: 'Walk',
          distance: 1000,
          movingTime: 600,
          averageSpeed: 1.67,
          startDate: new Date('2024-01-01'),
          elevationGain: 0,
          userId: 'temp_12345',
        },
      ];

      const mockStravaIntegrationService = require('../../services/stravaIntegrationService').stravaIntegrationService;
      mockStravaIntegrationService.syncUserFitnessData.mockResolvedValue({
        activities: lowActivityUser,
        fitnessMetrics: {
          weeklyDistance: 1000,
          weeklyActivities: 1,
          averagePace: 600,
          favoriteActivities: ['Walk'],
          totalDistance: 1000,
          longestRun: 1000,
        },
        profile: mockStravaResponse.athlete,
      });

      // Execute registration
      const result = await UserRegistrationService.registerUser({
        stravaAuthResponse: mockStravaResponse,
      });

      // Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('FITNESS_THRESHOLD_NOT_MET');
      expect(result.message).toContain("doesn't meet our minimum requirements");
      expect(result.fitnessEvaluation).toBeDefined();
      
      // Verify user was not created
      expect(mockUserModel.create).not.toHaveBeenCalled();
    });

    it('should return error if user already exists', async () => {
      const existingUser = {
        id: 'existing_user',
        email: 'john.doe@example.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 30,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: '',
        photos: [],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      mockUserModel.findByStravaId.mockResolvedValue(existingUser);

      const result = await UserRegistrationService.registerUser({
        stravaAuthResponse: mockStravaResponse,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('USER_ALREADY_EXISTS');
      expect(result.message).toContain('already exists');
    });

    it('should handle registration errors gracefully', async () => {
      mockUserModel.findByStravaId.mockResolvedValue(null);
      mockFitnessThresholdModel.getCurrent.mockRejectedValue(new Error('Database error'));

      const result = await UserRegistrationService.registerUser({
        stravaAuthResponse: mockStravaResponse,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('REGISTRATION_FAILED');
      expect(result.message).toContain('Failed to evaluate fitness requirements');
    });
  });

  describe('UserRegistrationService.validateProfileData', () => {
    it('should validate correct profile data', () => {
      const validData = {
        email: 'test@example.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: 'Fitness enthusiast',
        photos: ['https://example.com/photo.jpg'],
      };

      const result = UserRegistrationService.validateProfileData(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedData).toBeDefined();
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'invalid-email',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const result = UserRegistrationService.validateProfileData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid email address is required');
    });

    it('should reject invalid age', () => {
      const invalidData = {
        email: 'test@example.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 15, // Too young
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
      };

      const result = UserRegistrationService.validateProfileData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Age must be between 18 and 100');
    });

    it('should sanitize string inputs', () => {
      const dataWithHtml = {
        email: 'test@example.com',
        stravaId: 12345,
        firstName: 'John<script>',
        lastName: 'Doe>alert',
        age: 25,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: '<p>Bio with HTML</p>',
      };

      const result = UserRegistrationService.validateProfileData(dataWithHtml);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.firstName).toBe('Johnscript');
      expect(result.sanitizedData?.lastName).toBe('Doealert');
      expect(result.sanitizedData?.bio).toBe('pBio with HTML/p');
    });

    it('should limit bio length', () => {
      const longBio = 'a'.repeat(600); // Exceeds 500 character limit
      const invalidData = {
        email: 'test@example.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: longBio,
      };

      const result = UserRegistrationService.validateProfileData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bio must be 500 characters or less');
    });

    it('should validate photo URLs', () => {
      const invalidData = {
        email: 'test@example.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        photos: ['not-a-url', 'https://valid.com/photo.jpg'],
      };

      const result = UserRegistrationService.validateProfileData(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All photo URLs must be valid');
    });
  });

  describe('UserRegistrationService.updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        stravaId: 12345,
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
        city: 'San Francisco',
        state: 'CA',
        latitude: 37.7749,
        longitude: -122.4194,
        bio: 'Old bio',
        photos: [],
        createdAt: new Date(),
        lastActive: new Date(),
      };

      const updatedUser = {
        ...mockUser,
        age: 30,
        bio: 'New bio',
        city: 'Los Angeles',
        state: 'CA',
        latitude: 34.0522,
        longitude: -118.2437,
      };

      mockUserModel.findById.mockResolvedValue(mockUser);
      mockUserModel.update.mockResolvedValue(updatedUser);

      const result = await UserRegistrationService.updateUserProfile('user_123', {
        age: 30,
        bio: 'New bio',
        city: 'Los Angeles',
      });

      expect(result.age).toBe(30);
      expect(result.bio).toBe('New bio');
      expect(result.city).toBe('Los Angeles');
      expect(mockUserModel.update).toHaveBeenCalledWith('user_123', expect.objectContaining({
        age: 30,
        bio: 'New bio',
        city: 'Los Angeles',
        latitude: 34.0522,
        longitude: -118.2437,
      }));
    });

    it('should reject invalid profile updates', async () => {
      await expect(
        UserRegistrationService.updateUserProfile('user_123', {
          age: 15, // Invalid age
        })
      ).rejects.toThrow('Age must be between 18 and 100');
    });
  });

  describe('UserRegistrationService.getRegistrationStatus', () => {
    it('should return existing user status', async () => {
      const existingUser = {
        id: 'user_123',
        email: 'test@example.com',
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

      mockUserModel.findByStravaId.mockResolvedValue(existingUser);

      const result = await UserRegistrationService.getRegistrationStatus(12345);

      expect(result.exists).toBe(true);
      expect(result.user).toEqual(existingUser);
      expect(result.canRegister).toBe(false);
      expect(result.message).toBe('User already registered');
    });

    it('should return can register status for new user', async () => {
      mockUserModel.findByStravaId.mockResolvedValue(null);

      const result = await UserRegistrationService.getRegistrationStatus(12345);

      expect(result.exists).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.canRegister).toBe(true);
      expect(result.message).toBe('User can proceed with registration');
    });
  });
});