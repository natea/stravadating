import { Response } from 'express';
import { AdminController, AdminRequest } from '../adminController';
import { FitnessEvaluationService } from '../../services/fitnessEvaluationService';
import { FitnessThresholdModel } from '../../models/FitnessThreshold';
import { FitnessThreshold } from '../../types/fitness';

// Mock the dependencies
jest.mock('../../services/fitnessEvaluationService');
jest.mock('../../models/FitnessThreshold');
jest.mock('../../utils/logger');

const mockFitnessEvaluationService = FitnessEvaluationService as jest.Mocked<typeof FitnessEvaluationService>;
const mockFitnessThresholdModel = FitnessThresholdModel as jest.Mocked<typeof FitnessThresholdModel>;

describe('AdminController', () => {
  let mockRequest: Partial<AdminRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      user: {
        userId: 'admin1',
        stravaId: 12345,
        email: 'admin@test.com',
      },
      body: {},
      params: {},
      query: {},
    };
    
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    jest.clearAllMocks();
  });

  describe('getCurrentThreshold', () => {
    it('should return current threshold', async () => {
      const mockThreshold: FitnessThreshold = {
        id: 'threshold1',
        weeklyDistance: 10000,
        weeklyActivities: 3,
        averagePace: 360,
        allowedActivityTypes: ['Run', 'Ride'],
        updatedAt: new Date(),
        updatedBy: 'admin',
      };

      mockFitnessThresholdModel.getCurrent.mockResolvedValue(mockThreshold);

      await AdminController.getCurrentThreshold(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockThreshold,
      });
    });

    it('should initialize default threshold if none exists', async () => {
      const mockDefaultThreshold: FitnessThreshold = {
        id: 'threshold1',
        weeklyDistance: 10000,
        weeklyActivities: 3,
        averagePace: 360,
        allowedActivityTypes: ['Run', 'Ride', 'Swim', 'Hike', 'Walk'],
        updatedAt: new Date(),
        updatedBy: 'system',
      };

      mockFitnessThresholdModel.getCurrent.mockResolvedValue(null);
      mockFitnessEvaluationService.initializeDefaultThreshold.mockResolvedValue(mockDefaultThreshold);

      await AdminController.getCurrentThreshold(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockDefaultThreshold,
        message: 'Default threshold initialized',
      });
    });

    it('should handle errors', async () => {
      mockFitnessThresholdModel.getCurrent.mockRejectedValue(new Error('Database error'));

      await AdminController.getCurrentThreshold(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to retrieve fitness threshold',
      });
    });
  });

  describe('updateThreshold', () => {
    it('should update threshold successfully', async () => {
      const mockUpdatedThreshold: FitnessThreshold = {
        id: 'threshold2',
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: 300,
        allowedActivityTypes: ['Run'],
        updatedAt: new Date(),
        updatedBy: 'admin@test.com',
      };

      mockRequest.body = {
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: 300,
        allowedActivityTypes: ['Run'],
      };

      mockFitnessEvaluationService.updateThreshold.mockResolvedValue(mockUpdatedThreshold);

      await AdminController.updateThreshold(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockFitnessEvaluationService.updateThreshold).toHaveBeenCalledWith({
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: 300,
        allowedActivityTypes: ['Run'],
        updatedBy: 'admin@test.com',
      });

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedThreshold,
        message: 'Fitness threshold updated successfully',
      });
    });

    it('should handle validation errors', async () => {
      mockRequest.body = {
        weeklyDistance: -1000,
      };

      mockFitnessEvaluationService.updateThreshold.mockRejectedValue(
        new Error('Weekly distance must be between 0 and 100,000 meters')
      );

      await AdminController.updateThreshold(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Weekly distance must be between 0 and 100,000 meters',
      });
    });
  });

  describe('evaluateUserFitness', () => {
    it('should evaluate user fitness successfully', async () => {
      const mockEvaluation = {
        meets: true,
        metrics: {
          weeklyDistance: 12000,
          weeklyActivities: 4,
          averagePace: 350,
          activityTypes: ['Run'],
          totalDistance: 156000,
          longestActivity: 21000,
          consistencyScore: 85,
        },
        threshold: null,
        reasons: ['All requirements met'],
        score: 95,
      };

      mockRequest.params = { userId: 'user123' };
      mockFitnessEvaluationService.evaluateUserFitness.mockResolvedValue(mockEvaluation);

      await AdminController.evaluateUserFitness(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockFitnessEvaluationService.evaluateUserFitness).toHaveBeenCalledWith('user123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockEvaluation,
      });
    });

    it('should handle missing user ID', async () => {
      mockRequest.params = {};

      await AdminController.evaluateUserFitness(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'User ID is required',
      });
    });
  });

  describe('batchEvaluateUsers', () => {
    it('should batch evaluate users successfully', async () => {
      const mockEvaluations = new Map([
        ['user1', {
          meets: true,
          metrics: {} as any,
          threshold: null,
          reasons: [],
          score: 90,
        }],
        ['user2', {
          meets: false,
          metrics: {} as any,
          threshold: null,
          reasons: [],
          score: 60,
        }],
      ]);

      mockRequest.body = {
        userIds: ['user1', 'user2'],
      };

      mockFitnessEvaluationService.batchEvaluateUsers.mockResolvedValue(mockEvaluations);

      await AdminController.batchEvaluateUsers(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          evaluations: {
            user1: mockEvaluations.get('user1'),
            user2: mockEvaluations.get('user2'),
          },
          summary: {
            total: 2,
            evaluated: 2,
            passed: 1,
          },
        },
      });
    });

    it('should handle invalid user IDs array', async () => {
      mockRequest.body = {
        userIds: 'not-an-array',
      };

      await AdminController.batchEvaluateUsers(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'User IDs array is required',
      });
    });

    it('should handle too many user IDs', async () => {
      mockRequest.body = {
        userIds: new Array(101).fill('user'),
      };

      await AdminController.batchEvaluateUsers(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Maximum 100 users can be evaluated at once',
      });
    });
  });

  describe('resetToDefault', () => {
    it('should reset threshold to default values', async () => {
      const mockDefaultThreshold: FitnessThreshold = {
        id: 'threshold3',
        weeklyDistance: 10000,
        weeklyActivities: 3,
        averagePace: 360,
        allowedActivityTypes: ['Run', 'Ride', 'Swim', 'Hike', 'Walk'],
        updatedAt: new Date(),
        updatedBy: 'admin@test.com',
      };

      mockFitnessThresholdModel.getDefaultThreshold.mockReturnValue({
        weeklyDistance: 10000,
        weeklyActivities: 3,
        averagePace: 360,
        allowedActivityTypes: ['Run', 'Ride', 'Swim', 'Hike', 'Walk'],
        updatedBy: 'system',
      });

      mockFitnessEvaluationService.updateThreshold.mockResolvedValue(mockDefaultThreshold);

      await AdminController.resetToDefault(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockFitnessEvaluationService.updateThreshold).toHaveBeenCalledWith({
        weeklyDistance: 10000,
        weeklyActivities: 3,
        averagePace: 360,
        allowedActivityTypes: ['Run', 'Ride', 'Swim', 'Hike', 'Walk'],
        updatedBy: 'admin@test.com',
      });

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockDefaultThreshold,
        message: 'Fitness threshold reset to default values',
      });
    });
  });

  describe('validateThreshold', () => {
    it('should validate threshold values successfully', async () => {
      mockRequest.body = {
        weeklyDistance: 15000,
        weeklyActivities: 4,
      };

      const mockThreshold: FitnessThreshold = {
        id: 'threshold1',
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: null,
        allowedActivityTypes: [],
        updatedAt: new Date(),
        updatedBy: 'validation',
      };

      mockFitnessEvaluationService.updateThreshold.mockResolvedValue(mockThreshold);

      await AdminController.validateThreshold(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Threshold values are valid',
      });
    });

    it('should handle validation errors', async () => {
      mockRequest.body = {
        weeklyDistance: -1000,
      };

      mockFitnessEvaluationService.updateThreshold.mockRejectedValue(
        new Error('Weekly distance must be between 0 and 100,000 meters')
      );

      await AdminController.validateThreshold(mockRequest as AdminRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Weekly distance must be between 0 and 100,000 meters',
      });
    });
  });
});