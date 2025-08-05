import { MatchingService } from '../../services/matchingService';

// Mock all dependencies
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

import { UserModel } from '../../models/User';
import { FitnessStatsModel } from '../../models/FitnessStats';
import { MatchingPreferencesModel } from '../../models/MatchingPreferences';
import { MatchModel } from '../../models/Match';
import { prisma } from '../../config/database';

const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockFitnessStatsModel = FitnessStatsModel as jest.Mocked<typeof FitnessStatsModel>;
const mockMatchingPreferencesModel = MatchingPreferencesModel as jest.Mocked<typeof MatchingPreferencesModel>;
const mockMatchModel = MatchModel as jest.Mocked<typeof MatchModel>;

// Use the mocked prisma
const mockPrisma = prisma as any;

describe('MatchingService', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('findPotentialMatches', () => {
    const userId = 'user1';
    const mockUser = {
      id: userId,
      email: 'user1@test.com',
      stravaId: 12345,
      firstName: 'John',
      lastName: 'Doe',
      age: 30,
      latitude: 40.7128,
      longitude: -74.0060,
      city: 'New York',
      state: 'NY',
      photos: ['photo1.jpg'],
      bio: 'Love running!',
      createdAt: new Date(),
      lastActive: new Date(),
    };

    const mockFitnessStats = {
      id: 'stats1',
      userId,
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
      userId,
      minAge: 20,
      maxAge: 40,
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

    it('should find and rank potential matches for a user', async () => {
      const potentialUser = {
        id: 'user2',
        firstName: 'Jane',
        lastName: 'Smith',
        age: 28,
        city: 'New York',
        state: 'NY',
        latitude: 40.7580,
        longitude: -73.9855,
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

      mockPrisma.user.findMany.mockResolvedValue([potentialUser]);
      mockPrisma.stravaActivity.findMany
        .mockResolvedValueOnce([{ type: 'Run' }])
        .mockResolvedValueOnce([{ type: 'Run' }]);

      const matches = await MatchingService.findPotentialMatches(userId, 10, 0);

      expect(matches).toHaveLength(1);
      expect(matches[0].userId).toBe('user2');
      expect(matches[0].compatibilityScore).toBeGreaterThan(0);
      expect(matches[0].compatibilityFactors).toHaveProperty('activityOverlap');
      expect(matches[0].compatibilityFactors).toHaveProperty('performanceSimilarity');
      expect(matches[0].compatibilityFactors).toHaveProperty('locationProximity');
      expect(matches[0].compatibilityFactors).toHaveProperty('ageCompatibility');
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
        userId,
        minAge: 18,
        maxAge: 65,
        maxDistance: 50,
        preferredActivities: [],
        minCompatibilityScore: 0,
      });

      mockPrisma.user.findMany.mockResolvedValue([]);

      await MatchingService.findPotentialMatches(userId, 10, 0);

      expect(mockMatchingPreferencesModel.getDefaultPreferences).toHaveBeenCalledWith(userId);
    });
  });

  describe('calculateCompatibilityScore', () => {
    it('should calculate compatibility score between two users', async () => {
      const user1 = {
        id: 'user1',
        age: 30,
        latitude: 40.7128,
        longitude: -74.0060,
      };

      const user1Stats = {
        weeklyDistance: 50000,
        weeklyActivities: 5,
        averagePace: 300,
        favoriteActivities: ['Run', 'Bike'],
      };

      const user2 = {
        id: 'user2',
        age: 28,
        latitude: 40.7580,
        longitude: -73.9855,
      };

      const user2Stats = {
        weeklyDistance: 45000,
        weeklyActivities: 4,
        averagePace: 320,
        favoriteActivities: ['Run', 'Swim'],
      };

      mockPrisma.stravaActivity.findMany
        .mockResolvedValueOnce([{ type: 'Run' }, { type: 'Bike' }])
        .mockResolvedValueOnce([{ type: 'Run' }, { type: 'Swim' }]);

      const result = await MatchingService.calculateCompatibilityScore(
        user1,
        user1Stats,
        user2,
        user2Stats
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.factors).toHaveProperty('activityOverlap');
      expect(result.factors).toHaveProperty('performanceSimilarity');
      expect(result.factors).toHaveProperty('locationProximity');
      expect(result.factors).toHaveProperty('ageCompatibility');
    });

    it('should return 0 for activity overlap when no activities exist', async () => {
      mockPrisma.stravaActivity.findMany.mockResolvedValue([]);

      const result = await MatchingService.calculateCompatibilityScore(
        { id: 'user1', age: 30, latitude: 0, longitude: 0 },
        { weeklyDistance: 0, weeklyActivities: 0, averagePace: null },
        { id: 'user2', age: 30, latitude: 0, longitude: 0 },
        { weeklyDistance: 0, weeklyActivities: 0, averagePace: null }
      );

      expect(result.factors.activityOverlap).toBe(0);
    });
  });

  describe('createMatch', () => {
    it('should create a new match between users', async () => {
      const user1Id = 'user1';
      const user2Id = 'user2';
      const compatibilityScore = 85;

      const mockMatch = {
        id: 'match1',
        user1Id,
        user2Id,
        compatibilityScore,
        matchedAt: new Date(),
        status: 'active' as const,
      };

      mockMatchModel.findByUserIds.mockResolvedValue(null);
      mockMatchModel.create.mockResolvedValue(mockMatch);

      const result = await MatchingService.createMatch(
        user1Id,
        user2Id,
        compatibilityScore
      );

      expect(result).toEqual(mockMatch);
      expect(mockMatchModel.create).toHaveBeenCalledWith({
        user1Id,
        user2Id,
        compatibilityScore,
      });
    });

    it('should throw error if match already exists', async () => {
      const existingMatch = {
        id: 'match1',
        user1Id: 'user1',
        user2Id: 'user2',
        compatibilityScore: 85,
        matchedAt: new Date(),
        status: 'active' as const,
      };

      mockMatchModel.findByUserIds.mockResolvedValue(existingMatch);

      await expect(
        MatchingService.createMatch('user1', 'user2', 85)
      ).rejects.toThrow('Match already exists between these users');
    });
  });

  describe('updateMatchingPreferences', () => {
    it('should update user matching preferences', async () => {
      const userId = 'user1';
      const preferences = {
        minAge: 25,
        maxAge: 35,
        maxDistance: 100,
        preferredActivities: ['Run', 'Bike', 'Swim'],
        minCompatibilityScore: 60,
      };

      const updatedPreferences = {
        id: 'pref1',
        userId,
        ...preferences,
      };

      mockMatchingPreferencesModel.upsert.mockResolvedValue(updatedPreferences);

      const result = await MatchingService.updateMatchingPreferences(
        userId,
        preferences
      );

      expect(result).toEqual(updatedPreferences);
      expect(mockMatchingPreferencesModel.upsert).toHaveBeenCalledWith(userId, {
        userId,
        ...preferences,
      });
    });
  });

  describe('getMatchingPreferences', () => {
    it('should return user preferences if they exist', async () => {
      const userId = 'user1';
      const preferences = {
        id: 'pref1',
        userId,
        minAge: 25,
        maxAge: 35,
        maxDistance: 100,
        preferredActivities: ['Run'],
        minCompatibilityScore: 60,
      };

      mockMatchingPreferencesModel.findByUserId.mockResolvedValue(preferences);

      const result = await MatchingService.getMatchingPreferences(userId);

      expect(result).toEqual(preferences);
    });

    it('should return default preferences if none exist', async () => {
      const userId = 'user1';
      const defaultPreferences = {
        userId,
        minAge: 18,
        maxAge: 65,
        maxDistance: 50,
        preferredActivities: [],
        minCompatibilityScore: 0,
      };

      mockMatchingPreferencesModel.findByUserId.mockResolvedValue(null);
      mockMatchingPreferencesModel.getDefaultPreferences.mockReturnValue(defaultPreferences);

      const result = await MatchingService.getMatchingPreferences(userId);

      expect(result).toEqual(defaultPreferences);
      expect(mockMatchingPreferencesModel.getDefaultPreferences).toHaveBeenCalledWith(userId);
    });
  });
});