import { FitnessEvaluationService } from '../fitnessEvaluationService';
import { FitnessThresholdModel } from '../../models/FitnessThreshold';
import { StravaActivityModel } from '../../models/StravaActivity';
import { StravaActivity } from '../../types/strava';
import { FitnessThreshold } from '../../types/fitness';

// Mock the dependencies
jest.mock('../../models/FitnessThreshold');
jest.mock('../../models/StravaActivity');
jest.mock('../../utils/logger');

const mockFitnessThresholdModel = FitnessThresholdModel as jest.Mocked<typeof FitnessThresholdModel>;
const mockStravaActivityModel = StravaActivityModel as jest.Mocked<typeof StravaActivityModel>;

describe('FitnessEvaluationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateFitnessMetrics', () => {
    it('should return zero metrics for empty activities array', () => {
      const metrics = FitnessEvaluationService.calculateFitnessMetrics([]);

      expect(metrics).toEqual({
        weeklyDistance: 0,
        weeklyActivities: 0,
        averagePace: undefined,
        activityTypes: [],
        totalDistance: 0,
        longestActivity: 0,
        consistencyScore: 0,
      });
    });

    it('should calculate correct metrics for running activities', () => {
      const activities: StravaActivity[] = [
        {
          id: 1,
          userId: 'user1',
          name: 'Morning Run',
          type: 'Run',
          distance: 5000, // 5km
          movingTime: 1800, // 30 minutes
          averageSpeed: 2.78, // ~5:59/km pace
          startDate: new Date('2024-01-15'),
          elevationGain: 50,
          syncedAt: new Date(),
        },
        {
          id: 2,
          userId: 'user1',
          name: 'Evening Run',
          type: 'Run',
          distance: 10000, // 10km
          movingTime: 3000, // 50 minutes
          averageSpeed: 3.33, // ~5:00/km pace
          startDate: new Date('2024-01-10'),
          elevationGain: 100,
          syncedAt: new Date(),
        },
        {
          id: 3,
          userId: 'user1',
          name: 'Bike Ride',
          type: 'Ride',
          distance: 20000, // 20km
          movingTime: 2400, // 40 minutes
          averageSpeed: 8.33, // 20km/h
          startDate: new Date('2024-01-12'),
          elevationGain: 200,
          syncedAt: new Date(),
        },
      ];

      const metrics = FitnessEvaluationService.calculateFitnessMetrics(activities);

      expect(metrics.totalDistance).toBe(35000);
      expect(metrics.weeklyDistance).toBeCloseTo(35000 / (90/7), 1); // ~2692
      expect(metrics.weeklyActivities).toBeCloseTo(3 / (90/7), 1); // ~0.23
      expect(metrics.activityTypes).toEqual(['Run', 'Ride']);
      expect(metrics.longestActivity).toBe(20000);
      expect(metrics.averagePace).toBeDefined();
      expect(metrics.consistencyScore).toBeGreaterThan(0);
    });

    it('should calculate average pace only for running activities', () => {
      const activities: StravaActivity[] = [
        {
          id: 1,
          userId: 'user1',
          name: 'Run',
          type: 'Run',
          distance: 5000,
          movingTime: 1500,
          averageSpeed: 3.33, // 5:00/km pace = 300 seconds/km
          startDate: new Date('2024-01-15'),
          elevationGain: 0,
          syncedAt: new Date(),
        },
        {
          id: 2,
          userId: 'user1',
          name: 'Bike',
          type: 'Ride',
          distance: 20000,
          movingTime: 2400,
          averageSpeed: 8.33,
          startDate: new Date('2024-01-10'),
          elevationGain: 0,
          syncedAt: new Date(),
        },
      ];

      const metrics = FitnessEvaluationService.calculateFitnessMetrics(activities);

      // Should only consider the running activity for pace
      expect(metrics.averagePace).toBeCloseTo(300, 0); // 5:00/km
    });

    it('should handle activities with zero speed', () => {
      const activities: StravaActivity[] = [
        {
          id: 1,
          userId: 'user1',
          name: 'Broken GPS Run',
          type: 'Run',
          distance: 5000,
          movingTime: 1500,
          averageSpeed: 0, // Broken GPS
          startDate: new Date('2024-01-15'),
          elevationGain: 0,
          syncedAt: new Date(),
        },
      ];

      const metrics = FitnessEvaluationService.calculateFitnessMetrics(activities);

      expect(metrics.averagePace).toBeUndefined();
    });

    it('should filter out very short activities for pace calculation', () => {
      const activities: StravaActivity[] = [
        {
          id: 1,
          userId: 'user1',
          name: 'Short Run',
          type: 'Run',
          distance: 100, // Too short
          movingTime: 60,
          averageSpeed: 1.67,
          startDate: new Date('2024-01-15'),
          elevationGain: 0,
          syncedAt: new Date(),
        },
        {
          id: 2,
          userId: 'user1',
          name: 'Proper Run',
          type: 'Run',
          distance: 5000,
          movingTime: 1500,
          averageSpeed: 3.33,
          startDate: new Date('2024-01-10'),
          elevationGain: 0,
          syncedAt: new Date(),
        },
      ];

      const metrics = FitnessEvaluationService.calculateFitnessMetrics(activities);

      // Should only consider the longer run
      expect(metrics.averagePace).toBeCloseTo(300, 0);
    });
  });

  describe('evaluateUserFitness', () => {
    const mockThreshold: FitnessThreshold = {
      id: 'threshold1',
      weeklyDistance: 10000, // 10km per week
      weeklyActivities: 3,
      averagePace: 360, // 6:00/km
      allowedActivityTypes: ['Run', 'Ride'],
      updatedAt: new Date(),
      updatedBy: 'admin',
    };

    // Create activities that meet the weekly threshold (10km/week, 3 activities/week)
    // Over 13 weeks (90 days), need ~130km total and ~39 activities
    const mockActivities: StravaActivity[] = [];
    
    // Generate 40 activities over 90 days, totaling 140km
    for (let i = 0; i < 40; i++) {
      const daysAgo = Math.floor(i * 2.25); // Spread over 90 days
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      
      mockActivities.push({
        id: i + 1,
        userId: 'user1',
        name: `Run ${i + 1}`,
        type: 'Run',
        distance: 3500, // 3.5km each = 140km total
        movingTime: 1260, // 21 minutes
        averageSpeed: 2.78, // ~6:00/km
        startDate: date,
        elevationGain: 0,
        syncedAt: new Date(),
      });
    }

    beforeEach(() => {
      mockFitnessThresholdModel.getCurrent.mockResolvedValue(mockThreshold);
      mockStravaActivityModel.findByUserIdAndDateRange.mockResolvedValue(mockActivities);
    });

    it('should evaluate user as meeting threshold', async () => {
      const result = await FitnessEvaluationService.evaluateUserFitness('user1');

      expect(result.meets).toBe(true);
      expect(result.threshold).toEqual(mockThreshold);
      expect(result.score).toBeGreaterThan(80);
      expect(result.reasons.some(reason => reason.includes('✓'))).toBe(true);
    });

    it('should evaluate user as not meeting distance threshold', async () => {
      // Mock activities with insufficient distance
      const lowDistanceActivities = mockActivities.map(activity => ({
        ...activity,
        distance: 1000, // Only 1km each
      }));
      
      mockStravaActivityModel.findByUserIdAndDateRange.mockResolvedValue(lowDistanceActivities);

      const result = await FitnessEvaluationService.evaluateUserFitness('user1');

      expect(result.meets).toBe(false);
      expect(result.reasons.some(reason => reason.includes('Weekly distance'))).toBe(true);
      expect(result.reasons.some(reason => reason.includes('below requirement'))).toBe(true);
    });

    it('should evaluate user as not meeting activity count threshold', async () => {
      // Mock only one activity
      mockStravaActivityModel.findByUserIdAndDateRange.mockResolvedValue([mockActivities[0]]);

      const result = await FitnessEvaluationService.evaluateUserFitness('user1');

      expect(result.meets).toBe(false);
      expect(result.reasons.some(reason => reason.includes('Weekly activities'))).toBe(true);
      expect(result.reasons.some(reason => reason.includes('below requirement'))).toBe(true);
    });

    it('should evaluate user as not meeting pace threshold', async () => {
      // Mock activities with slow pace
      const slowActivities = mockActivities.map(activity => ({
        ...activity,
        averageSpeed: 1.39, // ~12:00/km (slower than 6:00/km threshold)
      }));
      
      mockStravaActivityModel.findByUserIdAndDateRange.mockResolvedValue(slowActivities);

      const result = await FitnessEvaluationService.evaluateUserFitness('user1');

      expect(result.meets).toBe(false);
      expect(result.reasons.some(reason => reason.includes('Average pace'))).toBe(true);
      expect(result.reasons.some(reason => reason.includes('slower than requirement'))).toBe(true);
    });

    it('should evaluate user as not meeting activity type threshold', async () => {
      // Mock activities with disallowed types
      const wrongTypeActivities = mockActivities.map(activity => ({
        ...activity,
        type: 'Swim', // Not in allowed types
      }));
      
      mockStravaActivityModel.findByUserIdAndDateRange.mockResolvedValue(wrongTypeActivities);

      const result = await FitnessEvaluationService.evaluateUserFitness('user1');

      expect(result.meets).toBe(false);
      expect(result.reasons.some(reason => reason.includes('No activities match allowed types'))).toBe(true);
    });

    it('should handle no threshold configured', async () => {
      mockFitnessThresholdModel.getCurrent.mockResolvedValue(null);

      const result = await FitnessEvaluationService.evaluateUserFitness('user1');

      expect(result.meets).toBe(true);
      expect(result.threshold).toBeNull();
      expect(result.reasons).toContain('No fitness threshold configured');
    });

    it('should handle user with no activities', async () => {
      mockStravaActivityModel.findByUserIdAndDateRange.mockResolvedValue([]);

      const result = await FitnessEvaluationService.evaluateUserFitness('user1');

      expect(result.meets).toBe(false);
      expect(result.metrics.weeklyDistance).toBe(0);
      expect(result.metrics.weeklyActivities).toBe(0);
    });
  });

  describe('updateThreshold', () => {
    it('should update threshold with valid values', async () => {
      const mockUpdatedThreshold: FitnessThreshold = {
        id: 'threshold2',
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: 300,
        allowedActivityTypes: ['Run'],
        updatedAt: new Date(),
        updatedBy: 'admin@test.com',
      };

      mockFitnessThresholdModel.update.mockResolvedValue(mockUpdatedThreshold);

      const result = await FitnessEvaluationService.updateThreshold({
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: 300,
        allowedActivityTypes: ['Run'],
        updatedBy: 'admin@test.com',
      });

      expect(result).toEqual(mockUpdatedThreshold);
      expect(mockFitnessThresholdModel.update).toHaveBeenCalledWith({
        weeklyDistance: 15000,
        weeklyActivities: 4,
        averagePace: 300,
        allowedActivityTypes: ['Run'],
        updatedBy: 'admin@test.com',
      });
    });

    it('should throw error for invalid weekly distance', async () => {
      await expect(
        FitnessEvaluationService.updateThreshold({
          weeklyDistance: -1000,
          updatedBy: 'admin',
        })
      ).rejects.toThrow('Weekly distance must be between 0 and 100,000 meters');
    });

    it('should throw error for invalid weekly activities', async () => {
      await expect(
        FitnessEvaluationService.updateThreshold({
          weeklyActivities: 100,
          updatedBy: 'admin',
        })
      ).rejects.toThrow('Weekly activities must be between 0 and 50');
    });

    it('should throw error for invalid average pace', async () => {
      await expect(
        FitnessEvaluationService.updateThreshold({
          averagePace: 60, // Too fast (1:00/km)
          updatedBy: 'admin',
        })
      ).rejects.toThrow('Average pace must be between 3:00 and 20:00 per km');
    });

    it('should throw error for invalid activity types', async () => {
      await expect(
        FitnessEvaluationService.updateThreshold({
          allowedActivityTypes: ['InvalidType'],
          updatedBy: 'admin',
        })
      ).rejects.toThrow('Invalid activity types: InvalidType');
    });
  });

  describe('getUserAdmissionDecision', () => {
    it('should return admission decision for qualified user', async () => {
      const mockThreshold: FitnessThreshold = {
        id: 'threshold1',
        weeklyDistance: 5000,
        weeklyActivities: 2,
        averagePace: null,
        allowedActivityTypes: [],
        updatedAt: new Date(),
        updatedBy: 'admin',
      };

      // Create activities that meet the threshold
      const mockActivities: StravaActivity[] = [];
      for (let i = 0; i < 40; i++) {
        const daysAgo = Math.floor(i * 2.25);
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);
        
        mockActivities.push({
          id: i + 1,
          userId: 'user1',
          name: `Run ${i + 1}`,
          type: 'Run',
          distance: 3500,
          movingTime: 1260,
          averageSpeed: 2.78,
          startDate: date,
          elevationGain: 0,
          syncedAt: new Date(),
        });
      }

      mockFitnessThresholdModel.getCurrent.mockResolvedValue(mockThreshold);
      mockStravaActivityModel.findByUserIdAndDateRange.mockResolvedValue(mockActivities);

      const result = await FitnessEvaluationService.getUserAdmissionDecision('user1');

      expect(result.admitted).toBe(true);
      expect(result.message).toContain('Congratulations');
      expect(result.evaluation.score).toBeGreaterThan(0);
    });

    it('should return rejection decision for unqualified user', async () => {
      const mockThreshold: FitnessThreshold = {
        id: 'threshold1',
        weeklyDistance: 50000, // Very high threshold
        weeklyActivities: 10,
        averagePace: null,
        allowedActivityTypes: [],
        updatedAt: new Date(),
        updatedBy: 'admin',
      };

      mockFitnessThresholdModel.getCurrent.mockResolvedValue(mockThreshold);
      mockStravaActivityModel.findByUserIdAndDateRange.mockResolvedValue([]);

      const result = await FitnessEvaluationService.getUserAdmissionDecision('user1');

      expect(result.admitted).toBe(false);
      expect(result.message).toContain('doesn\'t meet our minimum requirements');
    });
  });

  describe('batchEvaluateUsers', () => {
    it('should evaluate multiple users', async () => {
      const mockThreshold: FitnessThreshold = {
        id: 'threshold1',
        weeklyDistance: 5000,
        weeklyActivities: 2,
        averagePace: null,
        allowedActivityTypes: [],
        updatedAt: new Date(),
        updatedBy: 'admin',
      };

      mockFitnessThresholdModel.getCurrent.mockResolvedValue(mockThreshold);
      mockStravaActivityModel.findByUserIdAndDateRange
        .mockResolvedValueOnce([]) // user1 - no activities
        .mockResolvedValueOnce((() => { // user2 - has activities that meet threshold
          const activities = [];
          for (let i = 0; i < 40; i++) {
            const daysAgo = Math.floor(i * 2.25);
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            
            activities.push({
              id: i + 1,
              userId: 'user2',
              name: `Run ${i + 1}`,
              type: 'Run',
              distance: 3500,
              movingTime: 1260,
              averageSpeed: 2.78,
              startDate: date,
              elevationGain: 0,
              syncedAt: new Date(),
            });
          }
          return activities;
        })());

      const results = await FitnessEvaluationService.batchEvaluateUsers(['user1', 'user2']);

      expect(results.size).toBe(2);
      expect(results.get('user1')?.meets).toBe(false);
      expect(results.get('user2')?.meets).toBe(true);
    });
  });
});