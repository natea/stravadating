import { Response } from 'express';
import { FitnessController, AuthenticatedRequest } from '../fitnessController';
import { FitnessEvaluationService } from '../../services/fitnessEvaluationService';
import { it } from 'node:test';
import { it } from 'node:test';
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
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

// Mock the dependencies
jest.mock('../../services/fitnessEvaluationService');
jest.mock('../../utils/logger');

const mockFitnessEvaluationService = FitnessEvaluationService as jest.Mocked<typeof FitnessEvaluationService>;

describe('FitnessController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {
      user: {
        userId: 'user123',
        stravaId: 12345,
        email: 'user@test.com',
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

  describe('evaluateMyFitness', () => {
    it('should evaluate user fitness successfully', async () => {
      const mockDecision = {
        admitted: true,
        evaluation: {
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
        },
        message: 'Congratulations! Your fitness level meets our community standards. Score: 95/100',
      };

      mockFitnessEvaluationService.getUserAdmissionDecision.mockResolvedValue(mockDecision);

      await FitnessController.evaluateMyFitness(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockFitnessEvaluationService.getUserAdmissionDecision).toHaveBeenCalledWith('user123');
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          admitted: true,
          score: 95,
          message: 'Congratulations! Your fitness level meets our community standards. Score: 95/100',
          metrics: mockDecision.evaluation.metrics,
          reasons: ['All requirements met'],
        },
      });
    });

    it('should handle unauthenticated user', async () => {
      delete mockRequest.user;

      await FitnessController.evaluateMyFitness(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should handle evaluation errors', async () => {
      mockFitnessEvaluationService.getUserAdmissionDecision.mockRejectedValue(new Error('Evaluation failed'));

      await FitnessController.evaluateMyFitness(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to evaluate fitness level',
      });
    });
  });

  describe('getThresholdInfo', () => {
    it('should return threshold information', async () => {
      const mockStatistics = {
        currentThreshold: {
          id: 'threshold1',
          weeklyDistance: 10000,
          weeklyActivities: 3,
          averagePace: 360,
          allowedActivityTypes: ['Run', 'Ride'],
          updatedAt: new Date(),
          updatedBy: 'admin',
        },
        totalEvaluations: 100,
        passRate: 0.75,
        averageScore: 82,
        commonFailureReasons: [],
      };

      mockFitnessEvaluationService.getThresholdStatistics.mockResolvedValue(mockStatistics);

      await FitnessController.getThresholdInfo(mockRequest as any, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          requirements: {
            weeklyDistance: 10000,
            weeklyActivities: 3,
            averagePace: 360,
            allowedActivityTypes: ['Run', 'Ride'],
          },
          description: {
            weeklyDistance: 'Minimum 10km per week',
            weeklyActivities: 'At least 3 activities per week',
            averagePace: 'Average pace faster than 6:00/km',
            allowedActivityTypes: 'Activities must include: Run, Ride',
          },
        },
      });
    });

    it('should handle no threshold configured', async () => {
      const mockStatistics = {
        currentThreshold: null,
        totalEvaluations: 0,
        passRate: 0,
        averageScore: 0,
        commonFailureReasons: [],
      };

      mockFitnessEvaluationService.getThresholdStatistics.mockResolvedValue(mockStatistics);

      await FitnessController.getThresholdInfo(mockRequest as any, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'No fitness threshold configured',
      });
    });

    it('should handle threshold with no pace requirement', async () => {
      const mockStatistics = {
        currentThreshold: {
          id: 'threshold1',
          weeklyDistance: 10000,
          weeklyActivities: 3,
          averagePace: null,
          allowedActivityTypes: [],
          updatedAt: new Date(),
          updatedBy: 'admin',
        },
        totalEvaluations: 0,
        passRate: 0,
        averageScore: 0,
        commonFailureReasons: [],
      };

      mockFitnessEvaluationService.getThresholdStatistics.mockResolvedValue(mockStatistics);

      await FitnessController.getThresholdInfo(mockRequest as any, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          requirements: {
            weeklyDistance: 10000,
            weeklyActivities: 3,
            averagePace: null,
            allowedActivityTypes: [],
          },
          description: {
            weeklyDistance: 'Minimum 10km per week',
            weeklyActivities: 'At least 3 activities per week',
            averagePace: null,
            allowedActivityTypes: 'All activity types accepted',
          },
        },
      });
    });
  });

  describe('getMyMetrics', () => {
    it('should return user metrics', async () => {
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
        reasons: [],
        score: 95,
      };

      mockFitnessEvaluationService.evaluateUserFitness.mockResolvedValue(mockEvaluation);

      await FitnessController.getMyMetrics(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          metrics: mockEvaluation.metrics,
          lastUpdated: expect.any(String),
        },
      });
    });

    it('should handle unauthenticated user', async () => {
      delete mockRequest.user;

      await FitnessController.getMyMetrics(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });
  });

  describe('checkEligibility', () => {
    it('should return eligibility for qualified user', async () => {
      const mockEvaluation = {
        meets: true,
        metrics: {} as any,
        threshold: null,
        reasons: [],
        score: 95,
      };

      mockFitnessEvaluationService.evaluateUserFitness.mockResolvedValue(mockEvaluation);

      await FitnessController.checkEligibility(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          eligible: true,
          score: 95,
          summary: 'You meet the fitness requirements!',
        },
      });
    });

    it('should return eligibility for unqualified user', async () => {
      const mockEvaluation = {
        meets: false,
        metrics: {} as any,
        threshold: null,
        reasons: [],
        score: 45,
      };

      mockFitnessEvaluationService.evaluateUserFitness.mockResolvedValue(mockEvaluation);

      await FitnessController.checkEligibility(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          eligible: false,
          score: 45,
          summary: 'You do not currently meet the fitness requirements.',
        },
      });
    });

    it('should handle unauthenticated user', async () => {
      delete mockRequest.user;

      await FitnessController.checkEligibility(mockRequest as AuthenticatedRequest, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });
  });
});