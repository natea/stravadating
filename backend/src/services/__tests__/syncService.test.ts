import { SyncService } from '../syncService';

// Mock dependencies
jest.mock('../stravaService');
jest.mock('../../models/StravaActivity');
jest.mock('../../models/FitnessStats');
jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('SyncService', () => {
  let service: SyncService;

  beforeEach(() => {
    service = new SyncService();
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a new SyncService instance', () => {
      expect(service).toBeInstanceOf(SyncService);
    });
  });

  describe('syncUserActivities', () => {
    it('should handle user not found', async () => {
      // Mock prisma to return a user without tokens
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        fitnessStats: null,
      });
      
      // Mock getUserStravaTokens to return null
      jest.spyOn(service as any, 'getUserStravaTokens').mockResolvedValue(null);

      const result = await service.syncUserActivities('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        activitiesSynced: 0,
        fitnessStatsUpdated: false,
        error: 'No Strava tokens found for user',
      });
    });
  });

  describe('updateUserFitnessStats', () => {
    it('should handle missing user', async () => {
      // This test verifies the method exists and can be called
      await expect(service.updateUserFitnessStats('user-1')).rejects.toThrow();
    });
  });

  describe('cleanupRevokedUsers', () => {
    it('should return cleanup result structure', async () => {
      const result = await service.cleanupRevokedUsers();

      expect(result).toHaveProperty('cleanedUsers');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('forceFullResync', () => {
    it('should handle missing tokens', async () => {
      // Mock getUserStravaTokens to return null
      jest.spyOn(service as any, 'getUserStravaTokens').mockResolvedValue(null);

      const result = await service.forceFullResync('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        activitiesSynced: 0,
        fitnessStatsUpdated: false,
        error: 'No Strava tokens found for user',
      });
    });
  });
});