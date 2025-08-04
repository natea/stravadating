import { Request, Response } from 'express';
import { MatchingController } from '../matchingController';
import { MatchingService } from '../../services/matchingService';
import { MatchModel } from '../../models/Match';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('../../services/matchingService');
jest.mock('../../models/Match');
jest.mock('../../utils/logger');

const mockMatchingService = MatchingService as jest.Mocked<typeof MatchingService>;
const mockMatchModel = MatchModel as jest.Mocked<typeof MatchModel>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('MatchingController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      user: { id: 'user1' },
      query: {},
      body: {},
      params: {},
    };
    
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    jest.clearAllMocks();
  });

  describe('getPotentialMatches', () => {
    it('should return potential matches successfully', async () => {
      const mockMatches = [
        {
          userId: 'user2',
          user: {
            id: 'user2',
            firstName: 'Jane',
            lastName: 'Doe',
            age: 25,
            city: 'New York',
            state: 'NY',
            photos: ['photo.jpg'],
            bio: 'Love running!',
          },
          compatibilityScore: 85,
          compatibilityFactors: {
            activityOverlap: 80,
            performanceSimilarity: 90,
            locationProximity: 85,
            ageCompatibility: 85,
          },
          fitnessStats: {
            weeklyDistance: 50000,
            weeklyActivities: 5,
            averagePace: 300,
            favoriteActivities: ['Run'],
            totalDistance: 1000000,
          },
        },
      ];

      mockMatchingService.findPotentialMatches.mockResolvedValue(mockMatches);

      await MatchingController.getPotentialMatches(mockRequest as Request, mockResponse as Response);

      expect(mockMatchingService.findPotentialMatches).toHaveBeenCalledWith('user1', 20, 0);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockMatches,
        pagination: {
          limit: 20,
          offset: 0,
          count: 1,
        },
      });
    });

    it('should handle custom pagination parameters', async () => {
      mockRequest.query = { limit: '10', offset: '5' };
      mockMatchingService.findPotentialMatches.mockResolvedValue([]);

      await MatchingController.getPotentialMatches(mockRequest as Request, mockResponse as Response);

      expect(mockMatchingService.findPotentialMatches).toHaveBeenCalledWith('user1', 10, 5);
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await MatchingController.getPotentialMatches(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'User not authenticated' });
    });

    it('should validate limit parameter', async () => {
      mockRequest.query = { limit: '150' };

      await MatchingController.getPotentialMatches(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Limit must be between 1 and 100' });
    });

    it('should validate offset parameter', async () => {
      mockRequest.query = { offset: '-1' };

      await MatchingController.getPotentialMatches(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Offset must be non-negative' });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service error');
      mockMatchingService.findPotentialMatches.mockRejectedValue(error);

      await MatchingController.getPotentialMatches(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to get potential matches',
        message: 'Service error',
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createMatch', () => {
    it('should create match successfully', async () => {
      const mockMatch = {
        id: 'match1',
        user1Id: 'user1',
        user2Id: 'user2',
        compatibilityScore: 85,
        matchedAt: new Date(),
        status: 'active',
      };

      mockRequest.body = {
        targetUserId: 'user2',
        compatibilityScore: 85,
      };

      mockMatchingService.createMatch.mockResolvedValue(mockMatch);

      await MatchingController.createMatch(mockRequest as Request, mockResponse as Response);

      expect(mockMatchingService.createMatch).toHaveBeenCalledWith('user1', 'user2', 85);
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockMatch,
        message: 'Match created successfully',
      });
    });

    it('should return 401 if user not authenticated', async () => {
      mockRequest.user = undefined;

      await MatchingController.createMatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'User not authenticated' });
    });

    it('should validate required fields', async () => {
      mockRequest.body = { compatibilityScore: 85 };

      await MatchingController.createMatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Target user ID is required' });
    });

    it('should prevent self-matching', async () => {
      mockRequest.body = {
        targetUserId: 'user1',
        compatibilityScore: 85,
      };

      await MatchingController.createMatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Cannot match with yourself' });
    });

    it('should validate compatibility score', async () => {
      mockRequest.body = {
        targetUserId: 'user2',
        compatibilityScore: 150,
      };

      await MatchingController.createMatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ 
        error: 'Compatibility score must be a number between 0 and 100' 
      });
    });

    it('should handle duplicate match error', async () => {
      mockRequest.body = {
        targetUserId: 'user2',
        compatibilityScore: 85,
      };

      const error = new Error('Match already exists between these users');
      mockMatchingService.createMatch.mockRejectedValue(error);

      await MatchingController.createMatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Match already exists',
        message: 'Match already exists between these users',
      });
    });
  });

  describe('getUserMatches', () => {
    it('should return user matches successfully', async () => {
      const mockMatches = {
        data: [
          {
            id: 'match1',
            user1Id: 'user1',
            user2Id: 'user2',
            compatibilityScore: 85,
            matchedAt: new Date(),
            status: 'active',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      mockMatchModel.findByUserId.mockResolvedValue(mockMatches);

      await MatchingController.getUserMatches(mockRequest as Request, mockResponse as Response);

      expect(mockMatchModel.findByUserId).toHaveBeenCalledWith('user1', { page: 1, limit: 20 });
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockMatches,
      });
    });

    it('should handle custom pagination', async () => {
      mockRequest.query = { page: '2', limit: '10' };
      mockMatchModel.findByUserId.mockResolvedValue({ data: [], pagination: {} });

      await MatchingController.getUserMatches(mockRequest as Request, mockResponse as Response);

      expect(mockMatchModel.findByUserId).toHaveBeenCalledWith('user1', { page: 2, limit: 10 });
    });

    it('should validate page parameter', async () => {
      mockRequest.query = { page: '0' };

      await MatchingController.getUserMatches(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Page must be greater than 0' });
    });
  });

  describe('getMatchStats', () => {
    it('should return match statistics successfully', async () => {
      const mockStats = {
        totalMatches: 10,
        activeMatches: 8,
        archivedMatches: 2,
        averageCompatibilityScore: 75.5,
      };

      mockMatchModel.getMatchStats.mockResolvedValue(mockStats);

      await MatchingController.getMatchStats(mockRequest as Request, mockResponse as Response);

      expect(mockMatchModel.getMatchStats).toHaveBeenCalledWith('user1');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockStats,
      });
    });
  });

  describe('archiveMatch', () => {
    it('should archive match successfully', async () => {
      const mockMatch = {
        id: 'match1',
        user1Id: 'user1',
        user2Id: 'user2',
        compatibilityScore: 85,
        matchedAt: new Date(),
        status: 'active',
      };

      const archivedMatch = { ...mockMatch, status: 'archived' };

      mockRequest.params = { matchId: 'match1' };
      mockMatchModel.findById.mockResolvedValue(mockMatch);
      mockMatchModel.archive.mockResolvedValue(archivedMatch);

      await MatchingController.archiveMatch(mockRequest as Request, mockResponse as Response);

      expect(mockMatchModel.findById).toHaveBeenCalledWith('match1');
      expect(mockMatchModel.archive).toHaveBeenCalledWith('match1');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: archivedMatch,
        message: 'Match archived successfully',
      });
    });

    it('should return 404 if match not found', async () => {
      mockRequest.params = { matchId: 'nonexistent' };
      mockMatchModel.findById.mockResolvedValue(null);

      await MatchingController.archiveMatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Match not found' });
    });

    it('should return 403 if user not authorized', async () => {
      const mockMatch = {
        id: 'match1',
        user1Id: 'user3',
        user2Id: 'user4',
        compatibilityScore: 85,
        matchedAt: new Date(),
        status: 'active',
      };

      mockRequest.params = { matchId: 'match1' };
      mockMatchModel.findById.mockResolvedValue(mockMatch);

      await MatchingController.archiveMatch(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Not authorized to archive this match' });
    });
  });

  describe('updateMatchingPreferences', () => {
    it('should update preferences successfully', async () => {
      const updatedPreferences = {
        id: 'pref1',
        userId: 'user1',
        minAge: 25,
        maxAge: 35,
        maxDistance: 30,
        preferredActivities: ['Run', 'Bike'],
        minCompatibilityScore: 70,
      };

      mockRequest.body = {
        minAge: 25,
        maxAge: 35,
        maxDistance: 30,
        preferredActivities: ['Run', 'Bike'],
        minCompatibilityScore: 70,
      };

      mockMatchingService.updateMatchingPreferences.mockResolvedValue(updatedPreferences);

      await MatchingController.updateMatchingPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockMatchingService.updateMatchingPreferences).toHaveBeenCalledWith('user1', {
        minAge: 25,
        maxAge: 35,
        maxDistance: 30,
        preferredActivities: ['Run', 'Bike'],
        minCompatibilityScore: 70,
      });
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: updatedPreferences,
        message: 'Matching preferences updated successfully',
      });
    });

    it('should validate age parameters', async () => {
      mockRequest.body = { minAge: 15 };

      await MatchingController.updateMatchingPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Minimum age must be between 18 and 100' });
    });

    it('should validate age range', async () => {
      mockRequest.body = { minAge: 35, maxAge: 25 };

      await MatchingController.updateMatchingPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Minimum age cannot be greater than maximum age' });
    });

    it('should validate distance parameter', async () => {
      mockRequest.body = { maxDistance: 1500 };

      await MatchingController.updateMatchingPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Maximum distance must be between 1 and 1000 km' });
    });

    it('should validate preferred activities parameter', async () => {
      mockRequest.body = { preferredActivities: 'not an array' };

      await MatchingController.updateMatchingPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Preferred activities must be an array' });
    });
  });

  describe('getMatchingPreferences', () => {
    it('should return preferences successfully', async () => {
      const mockPreferences = {
        id: 'pref1',
        userId: 'user1',
        minAge: 25,
        maxAge: 35,
        maxDistance: 30,
        preferredActivities: ['Run'],
        minCompatibilityScore: 70,
      };

      mockMatchingService.getMatchingPreferences.mockResolvedValue(mockPreferences);

      await MatchingController.getMatchingPreferences(mockRequest as Request, mockResponse as Response);

      expect(mockMatchingService.getMatchingPreferences).toHaveBeenCalledWith('user1');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockPreferences,
      });
    });
  });
});