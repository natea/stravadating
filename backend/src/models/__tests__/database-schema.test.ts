import { FitnessThresholdModel } from '../FitnessThreshold';

describe('Database Schema and Models', () => {
  describe('Type Definitions', () => {
    it('should have correct default fitness threshold structure', () => {
      const defaultThreshold = FitnessThresholdModel.getDefaultThreshold();
      
      expect(defaultThreshold).toHaveProperty('weeklyDistance');
      expect(defaultThreshold).toHaveProperty('weeklyActivities');
      expect(defaultThreshold).toHaveProperty('averagePace');
      expect(defaultThreshold).toHaveProperty('allowedActivityTypes');
      expect(defaultThreshold).toHaveProperty('updatedBy');
      
      expect(typeof defaultThreshold.weeklyDistance).toBe('number');
      expect(typeof defaultThreshold.weeklyActivities).toBe('number');
      expect(Array.isArray(defaultThreshold.allowedActivityTypes)).toBe(true);
      expect(defaultThreshold.updatedBy).toBe('system');
    });

    it('should have reasonable default values', () => {
      const defaultThreshold = FitnessThresholdModel.getDefaultThreshold();
      
      expect(defaultThreshold.weeklyDistance).toBe(10000); // 10km
      expect(defaultThreshold.weeklyActivities).toBe(3);
      expect(defaultThreshold.averagePace).toBe(360); // 6 min/km
      expect(defaultThreshold.allowedActivityTypes).toContain('Run');
      expect(defaultThreshold.allowedActivityTypes).toContain('Ride');
      expect(defaultThreshold.allowedActivityTypes).toContain('Swim');
    });
  });

  describe('Model Structure Validation', () => {
    it('should export all required models', () => {
      // Test that all models are properly exported
      const { UserModel } = require('../User');
      const { FitnessStatsModel } = require('../FitnessStats');
      const { StravaActivityModel } = require('../StravaActivity');
      const { MatchModel } = require('../Match');
      const { MatchingPreferencesModel } = require('../MatchingPreferences');
      const { MessageModel } = require('../Message');
      const { FitnessThresholdModel } = require('../FitnessThreshold');

      expect(UserModel).toBeDefined();
      expect(FitnessStatsModel).toBeDefined();
      expect(StravaActivityModel).toBeDefined();
      expect(MatchModel).toBeDefined();
      expect(MatchingPreferencesModel).toBeDefined();
      expect(MessageModel).toBeDefined();
      expect(FitnessThresholdModel).toBeDefined();
    });

    it('should have required static methods on UserModel', () => {
      const { UserModel } = require('../User');
      
      expect(typeof UserModel.create).toBe('function');
      expect(typeof UserModel.findById).toBe('function');
      expect(typeof UserModel.findByEmail).toBe('function');
      expect(typeof UserModel.findByStravaId).toBe('function');
      expect(typeof UserModel.update).toBe('function');
      expect(typeof UserModel.delete).toBe('function');
      expect(typeof UserModel.findMany).toBe('function');
      expect(typeof UserModel.findUsersWithinDistance).toBe('function');
    });

    it('should have required static methods on FitnessThresholdModel', () => {
      const { FitnessThresholdModel } = require('../FitnessThreshold');
      
      expect(typeof FitnessThresholdModel.create).toBe('function');
      expect(typeof FitnessThresholdModel.getCurrent).toBe('function');
      expect(typeof FitnessThresholdModel.update).toBe('function');
      expect(typeof FitnessThresholdModel.checkUserMeetsThreshold).toBe('function');
      expect(typeof FitnessThresholdModel.initializeDefault).toBe('function');
      expect(typeof FitnessThresholdModel.getDefaultThreshold).toBe('function');
    });
  });
});