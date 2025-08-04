import { MatchingService } from '../matchingService';
import { UserModel } from '../../models/User';
import { FitnessStatsModel } from '../../models/FitnessStats';
import { MatchingPreferencesModel } from '../../models/MatchingPreferences';
import { MatchModel } from '../../models/Match';
import { prisma } from '../../config/database';

// Mock the dependencies
jest.mock('../../models/User');
jest.mock('../../models/FitnessStats');
jest.mock('../../models/MatchingPreferences');
jest.mock('../../models/Match');
jest.mock('../../config/database', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
    },
    stravaActivity: {
      findMany: jest.fn(),
    },
  },
}));

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockFitnessStatsModel = FitnessStatsModel as jest.Mocked<typeof FitnessStatsModel>;
const mockMatchingPreferencesModel = MatchingPreferencesModel as jest.Mocked<typeof MatchingPreferencesModel>;
const mockMatchModel = MatchModel as jest.Mocked<typeof MatchModel>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('MatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCompatibilityScore', () => {
    const user1 = {
      id: 'user1',
      age: 25,
      latitude: 40.7128,
      longitude: -74.0060, // New York
    };

    const user1FitnessStats = {
      weeklyDistance: 50000, // 50km
      weeklyActivities: 5,
      averagePace: 300, // 5 min/km
      favoriteActivities: ['Run', 'Bike'],
    };

    const user2 = {
      id: 'user2',
      age: 27,
      latitude: 40.7589,
      longitude: -73.9851, // Also New York (close)
    };

    const user2FitnessStats = {
      weeklyDistance: 45000, // 45km
      weeklyActivities: 4,
      averagePace: 320, // 5.33 min/km
      favoriteActivities: ['Run', 'Swim'],
    };

    it('should calculate compatibility score correctly', async () => {
      // Mock activity overlap calculation
      (mockPrisma.stravaActivity.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { type: 'Run' },
          { type: 'Bike' },
        ])
        .mockResolvedValueOnce([
          { type: 'Run' },
          { type: 'Swim' },
        ]);

      const result = await MatchingService.calculateCompatibilityScore(
        user1,
        user1FitnessStats,
        user2,
        user2FitnessStats
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.factors).toHaveProperty('activityOverlap');
      expect(result.factors).toHaveProperty('performanceSimilarity');
      expect(result.factors).toHaveProperty('locationProximity');
      expect(result.factors).toHaveProperty('ageCompatibility');
    });

    it('should return high compatibility for similar users', async () => {
      const similarUser2 = {
        ...user2,
        age: 25, // Same age
        latitude: user1.latitude, // Same location
        longitude: user1.longitude,
      };

      const similarUser2FitnessStats = {
        ...user1FitnessStats, // Same fitness stats
      };

      // Mock identical activities
      mockPrisma.stravaActivity.findMany
        .mockResolvedValueOnce([
          { type: 'Run' },
          { type: 'Bike' },
        ])
        .mockResolvedValueOnce([
          { type: 'Run' },
          { type: 'Bike' },
        ]);

      const result = await MatchingService.calculateCompatibilityScore(
        user1,
        user1FitnessStats,
        similarUser2,
        similarUser2FitnessStats
      );

      expect(result.score).toBeGreaterThan(80); // High compatibility
    });

    it('should return low compatibility for very different users', async () => {
      const differentUser2 = {
        ...user2,
        age: 45, // Very different age
        latitude: 34.0522, // Los Angeles (far away)
        longitude: -118.2437,
      };

      const differentUser2FitnessStats = {
        weeklyDistance: 5000, // Much less distance
        weeklyActivities: 1,
        averagePace: 600, // Much slower pace
        favoriteActivities: ['Walk'],
      };

      // Mock no common activities
      mockPrisma.stravaActivity.findMany
        .mockResolvedValueOnce([
          { type: 'Run' },
          { type: 'Bike' },
        ])
        .mockResolvedValueOnce([
          { type: 'Walk' },
        ]);

      const result = await MatchingService.calculateCompatibilityScore(
        user1,
        user1FitnessStats,
        differentUser2,
        differentUser2FitnessStats
      );

      expect(result.score).toBeLessThan(30); // Low compatibility
    });
  });

  describe('findPotentialMatches', () => {
    const mockUser = {
      id: 'user1',
      email: 'user1@test.com',
      stravaId: 12345,
      firstName: 'John',
      lastName: 'Doe',
      age: 25,
      city: 'New York',
      state: 'NY',
      latitude: 40.7128,
      longitude: -74.0060,
      photos: ['photo1.jpg'],
      bio: 'Love running!',
      createdAt: new Date(),
      lastActive: new Date(),
    };

    const mockFitnessStats = {
      id: 'stats1',
      userId: 'user1',
      weeklyDistance: 50000,
      weeklyActivities: 5,
      averagePace: 300,
      favoriteActivities: ['Run', 'Bike'],
      totalDistance: 1000000,
      longestRun: 25000,
      lastSyncDate: new Date(),
    };

    const mockPreferences = {
      id: 'pref1',
      userId: 'user1',
      minAge: 20,
      maxAge: 35,
      maxDistance: 50,
      preferredActivities: ['Run'],
      minCompatibilityScore: 50,
    };

    beforeEach(() => {
      mockUserModel.findById.mockResolvedValue(mockUser);
      mockFitnessStatsModel.findByUserId.mockResolvedValue(mockFitnessStats);
      mockMatchingPreferencesModel.findByUserId.mockResolvedValue(mockPreferences);
      mockMatchModel.findByUserId.mockResolvedValue([]);
    });

    it('should find potential matches successfully', async () => {
      const potentialUser = {
        id: 'user2',
        firstName: 'Jane',
        lastName: 'Smith',
        age: 26,
        city: 'New York',
        state: 'NY',
        latitude: 40.7589,
        longitude: -73.9851,
        photos: ['photo2.jpg'],
        bio: 'Fitness enthusiast',
        fitnessStats: {
          weeklyDistance: 45000,
          weeklyActivities: 4,
          averagePace: 320,
          favoriteActivities: ['Run', 'Swim'],
          totalDistance: 800000,
        },
      };

      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([potentialUser]);

      // Mock activity overlap
      (mockPrisma.stravaActivity.findMany as jest.Mock)
        .mockResolvedValueOnce([{ type: 'Run' }])
        .mockResolvedValueOnce([{ type: 'Run' }]);

      const matches = await MatchingService.findPotentialMatches('user1', 10, 0);

      expect(matches).toHaveLength(1);
      expect(matches[0].userId).toBe('user2');
      expect(matches[0].compatibilityScore).toBeGreaterThan(0);
      expect(matches[0].user.firstName).toBe('Jane');
      expect(matches[0].fitnessStats.weeklyDistance).toBe(45000);
    });

    it('should filter out users below minimum compatibility score', async () => {
      const lowCompatibilityUser = {
        id: 'user2',
        firstName: 'Jane',
        lastName: 'Smith',
        age: 45, // Outside age range but within preferences
        city: 'Los Angeles',
        state: 'CA',
        latitude: 34.0522, // Far away
        longitude: -118.2437,
        photos: [],
        bio: null,
        fitnessStats: {
          weeklyDistance: 1000, // Very low activity
          weeklyActivities: 1,
          averagePace: 600,
          favoriteActivities: ['Walk'],
          totalDistance: 10000,
        },
      };

      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([lowCompatibilityUser]);

      // Mock no common activities
      (mockPrisma.stravaActivity.findMany as jest.Mock)
        .mockResolvedValueOnce([{ type: 'Run' }])
        .mockResolvedValueOnce([{ type: 'Walk' }]);

      const matches = await MatchingService.findPotentialMatches('user1', 10, 0);

      expect(matches).toHaveLength(0); // Should be filtered out due to low compatibility
    });

    it('should handle pagination correctly', async () => {
      const potentialUsers = Array.from({ length: 15 }, (_, i) => ({
        id: `user${i + 2}`,
        firstName: `User${i + 2}`,
        lastName: 'Test',
        age: 25,
        city: 'New York',
        state: 'NY',
        latitude: 40.7128,
        longitude: -74.0060,
        photos: [],
        bio: null,
        fitnessStats: {
          weeklyDistance: 50000,
          weeklyActivities: 5,
          averagePace: 300,
          favoriteActivities: ['Run'],
          totalDistance: 1000000,
        },
      }));

      mockPrisma.user.findMany.mockResolvedValue(potentialUsers);

      // Mock activity overlap for all users
      mockPrisma.stravaActivity.findMany.mockResolvedValue([{ type: 'Run' }]);

      const firstPage = await MatchingService.findPotentialMatches('user1', 10, 0);
      const secondPage = await MatchingService.findPotentialMatches('user1', 10, 10);

      expect(firstPage).toHaveLength(10);
      expect(secondPage).toHaveLength(5);
      expect(firstPage[0].userId).not.toBe(secondPage[0].userId);
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockResolvedValue(null);

      await expect(
        MatchingService.findPotentialMatches('nonexistent', 10, 0)
      ).rejects.toThrow('User or fitness stats not found');
    });

    it('should use default preferences if none exist', async () => {
      mockMatchingPreferencesModel.findByUserId.mockResolvedValue(null);
      mockMatchingPreferencesModel.getDefaultPreferences.mockReturnValue({
        userId: 'user1',
        minAge: 18,
        maxAge: 65,
        maxDistance: 50,
        preferredActivities: [],
        minCompatibilityScore: 0,
      });

      mockPrisma.user.findMany.mockResolvedValue([]);

      await MatchingService.findPotentialMatches('user1', 10, 0);

      expect(mockMatchingPreferencesModel.getDefaultPreferences).toHaveBeenCalledWith('user1');
    });
  });

  describe('createMatch', () => {
    it('should create a match successfully', async () => {
      const mockMatch = {
        id: 'match1',
        user1Id: 'user1',
        user2Id: 'user2',
        compatibilityScore: 85,
        matchedAt: new Date(),
        status: 'active',
      };

      mockMatchModel.findByUserIds.mockResolvedValue(null);
      mockMatchModel.create.mockResolvedValue(mockMatch);

      const result = await MatchingService.createMatch('user1', 'user2', 85);

      expect(result).toEqual(mockMatch);
      expect(mockMatchModel.create).toHaveBeenCalledWith({
        user1Id: 'user1',
        user2Id: 'user2',
        compatibilityScore: 85,
      });
    });

    it('should throw error if match already exists', async () => {
      const existingMatch = {
        id: 'match1',
        user1Id: 'user1',
        user2Id: 'user2',
        compatibilityScore: 85,
        matchedAt: new Date(),
        status: 'active',
      };

      mockMatchModel.findByUserIds.mockResolvedValue(existingMatch);

      await expect(
        MatchingService.createMatch('user1', 'user2', 85)
      ).rejects.toThrow('Match already exists between these users');
    });
  });

  describe('updateMatchingPreferences', () => {
    it('should update matching preferences successfully', async () => {
      const updatedPreferences = {
        id: 'pref1',
        userId: 'user1',
        minAge: 25,
        maxAge: 35,
        maxDistance: 30,
        preferredActivities: ['Run', 'Bike'],
        minCompatibilityScore: 70,
      };

      mockMatchingPreferencesModel.upsert.mockResolvedValue(updatedPreferences);

      const result = await MatchingService.updateMatchingPreferences('user1', {
        minAge: 25,
        maxAge: 35,
        maxDistance: 30,
        preferredActivities: ['Run', 'Bike'],
        minCompatibilityScore: 70,
      });

      expect(result).toEqual(updatedPreferences);
      expect(mockMatchingPreferencesModel.upsert).toHaveBeenCalledWith('user1', {
        userId: 'user1',
        minAge: 25,
        maxAge: 35,
        maxDistance: 30,
        preferredActivities: ['Run', 'Bike'],
        minCompatibilityScore: 70,
      });
    });
  });

  describe('getMatchingPreferences', () => {
    it('should return existing preferences', async () => {
      const existingPreferences = {
        id: 'pref1',
        userId: 'user1',
        minAge: 25,
        maxAge: 35,
        maxDistance: 30,
        preferredActivities: ['Run'],
        minCompatibilityScore: 70,
      };

      mockMatchingPreferencesModel.findByUserId.mockResolvedValue(existingPreferences);

      const result = await MatchingService.getMatchingPreferences('user1');

      expect(result).toEqual(existingPreferences);
    });

    it('should return default preferences if none exist', async () => {
      const defaultPreferences = {
        userId: 'user1',
        minAge: 18,
        maxAge: 65,
        maxDistance: 50,
        preferredActivities: [],
        minCompatibilityScore: 0,
      };

      mockMatchingPreferencesModel.findByUserId.mockResolvedValue(null);
      mockMatchingPreferencesModel.getDefaultPreferences.mockReturnValue(defaultPreferences);

      const result = await MatchingService.getMatchingPreferences('user1');

      expect(result).toEqual(defaultPreferences);
      expect(mockMatchingPreferencesModel.getDefaultPreferences).toHaveBeenCalledWith('user1');
    });
  });

  describe('distance calculation', () => {
    it('should calculate distance correctly', async () => {
      // Test with known coordinates (New York to Los Angeles ≈ 3944 km)
      const user1 = {
        id: 'user1',
        age: 25,
        latitude: 40.7128,
        longitude: -74.0060,
      };

      const user1FitnessStats = {
        weeklyDistance: 50000,
        weeklyActivities: 5,
        averagePace: 300,
      };

      const user2 = {
        id: 'user2',
        age: 25,
        latitude: 34.0522,
        longitude: -118.2437,
      };

      const user2FitnessStats = {
        weeklyDistance: 50000,
        weeklyActivities: 5,
        averagePace: 300,
      };

      mockPrisma.stravaActivity.findMany.mockResolvedValue([]);

      const result = await MatchingService.calculateCompatibilityScore(
        user1,
        user1FitnessStats,
        user2,
        user2FitnessStats
      );

      // Location proximity should be very low due to large distance
      expect(result.factors.locationProximity).toBeLessThan(10);
    });
  });
});